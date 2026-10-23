"""Short speaker/microphone AEC measurement; raw audio stays in memory and is never saved."""
import argparse
import importlib.util
import json
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]


def correlated_component(signal, reference, max_lag=4000):
    n = min(len(signal), len(reference))
    signal = np.asarray(signal[:n], dtype=np.float64)
    reference = np.asarray(reference[:n], dtype=np.float64)
    signal -= signal.mean(); reference -= reference.mean()
    fft_size = 1 << (2 * n - 1).bit_length()
    cross = np.fft.irfft(np.fft.rfft(signal, fft_size) * np.conj(np.fft.rfft(reference, fft_size)), fft_size)
    ref_energy = np.concatenate([[0], np.cumsum(reference ** 2)])
    sig_energy = np.concatenate([[0], np.cumsum(signal ** 2)])
    best = (0.0, 0.0, 0)
    for lag in range(-min(max_lag, n // 4), min(max_lag, n // 4) + 1):
        a, b = max(0, lag), n + min(0, lag)
        c, d = max(0, -lag), n - max(0, lag)
        dot = float(cross[lag % fft_size])
        re = ref_energy[d] - ref_energy[c]
        se = sig_energy[b] - sig_energy[a]
        power = dot * dot / (max(re, 1e-20) * (b - a))
        correlation = abs(dot) / np.sqrt(max(re * se, 1e-20))
        if power > best[0]: best = (power, correlation, lag)
    return best


def self_test():
    rng = np.random.default_rng(3)
    reference = rng.normal(0, 0.1, 16000)
    echo = np.concatenate([np.zeros(123), reference[:-123] * 0.6])
    before, correlation, lag = correlated_component(echo, reference)
    after, _, _ = correlated_component(echo * 0.1, reference)
    assert lag == 123 and correlation > 0.999
    assert abs(10 * np.log10(before / after) - 20) < 0.01
    assert correlated_component(np.zeros(16000), reference)[0] == 0
    print('AEC correlation measurement self-check passed')


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--mic', type=int)
    parser.add_argument('--reference', type=int)
    parser.add_argument('--speaker', type=int)
    parser.add_argument('--self-test', action='store_true')
    args = parser.parse_args()
    if args.self_test: self_test(); return
    self_test()
    spec = importlib.util.spec_from_file_location('aec_bridge', ROOT / 'scripts/aec-bridge.py')
    bridge = importlib.util.module_from_spec(spec); spec.loader.exec_module(bridge)
    devices = bridge.list_devices()
    mic = next((d for d in devices['capture'] if d['index'] == args.mic), None)
    reference = next((d for d in devices['loopback'] if d['index'] == args.reference), None)
    speaker = next((d for d in devices['playback'] if d['index'] == args.speaker), None)
    from web.audio import speaker_output_for_ref
    if not mic or not reference or not speaker or speaker_output_for_ref(reference['name'], devices['playback']) != args.speaker:
        parser.error('Select a microphone, actual speaker output, and its matching WASAPI loopback using start-aec.ps1 -List')
    chain = bridge.Chain(model_dir='models', num_threads=2); chain.set_ns_backend('off')
    if not chain.start(): raise RuntimeError(chain.last_error)
    bridge.guard_inference(chain)

    class Measurement(bridge.OBSRunner):
        def __init__(self):
            super().__init__(chain, mic_idx=args.mic, ref_idx=args.reference, out_idx=args.speaker)
            self.samples = []

        def _pump(self, mic, ref):
            super()._pump(mic, ref)
            clean = self._out_q.get_nowait()
            self.samples.append((mic.copy(), ref.copy(), clean.copy()))

    runner = Measurement(); pa = None; output = None
    try:
        pa = bridge.pa_patch.PyAudio()
        rate = int(pa.get_device_info_by_index(args.speaker)['defaultSampleRate'])
        channels = min(2, int(speaker['maxOutputChannels']))
        output = pa.open(format=bridge.pa_patch.paInt16, channels=channels, rate=rate, output=True, output_device_index=args.speaker)
        runner.start(); time.sleep(0.5)
        duration = 6
        t = np.arange(rate * duration) / rate
        rng = np.random.default_rng(7)
        noise = rng.standard_normal(len(t))
        spectrum = np.fft.rfft(noise); frequency = np.fft.rfftfreq(len(noise), 1 / rate)
        spectrum[(frequency < 250) | (frequency > 3200)] = 0
        sound = np.fft.irfft(spectrum, len(noise))
        sound *= 0.4 + 0.6 * np.maximum(0, np.sin(2 * np.pi * 2.3 * t))
        sound *= np.minimum(1, np.minimum(t, duration - t) * 50)
        sound *= 0.025 / max(np.max(np.abs(sound)), 1e-10)
        pcm = np.repeat((sound * 32767).astype(np.int16)[:, None], channels, axis=1)
        for i in range(0, len(pcm), 1024): output.write(pcm[i:i + 1024].tobytes())
        time.sleep(0.5)
    finally:
        runner.stop(); chain.stop()
        if output: output.stop_stream(); output.close()
        if pa: pa.terminate()
    if chain.last_error: raise RuntimeError(chain.last_error)
    if len(runner.samples) < 625: raise RuntimeError('Insufficient captured frames for an acoustic measurement')
    raw, ref, clean = [np.concatenate([row[i] for row in runner.samples]).astype(np.float64) / (32768 if i < 2 else 1) for i in range(3)]
    # Exclude startup adaptation and the speaker stop tail. Metrics describe correlated echo, not total sound quality.
    window = slice(16000 * 2, -16000)
    raw_power, correlation, lag = correlated_component(raw[window], ref[window])
    clean_power, _, clean_lag = correlated_component(clean[window], ref[window])
    reference_rms = float(np.sqrt(np.mean(ref[window] ** 2)))
    baseline_rms = float(np.sqrt(np.mean(raw[:6400] ** 2)))
    raw_rms = float(np.sqrt(np.mean(raw[window] ** 2)))
    observed = reference_rms > 1e-5 and correlation >= 0.2 and raw_rms > baseline_rms * 2
    reduction = float(10 * np.log10(max(raw_power, 1e-20) / max(clean_power, 1e-20)))
    result = {
        'result': ('pass' if reduction >= 6 else 'fail') if observed else 'inconclusive',
        'physicalMicrophoneAndSpeakerLoopback': True,
        'playedSyntheticCalibrationSeconds': 6,
        'digitalPlaybackPeak': 0.025,
        'referenceRms': reference_rms,
        'rawMicRms': raw_rms,
        'baselineMicRms': baseline_rms,
        'referenceMicCorrelation': round(float(correlation), 4),
        'speakerEchoObserved': observed,
        'correlatedEchoReductionDb': round(reduction, 2) if observed else None,
        'rawEchoLagSamples': lag,
        'processedEchoLagSamples': clean_lag,
        'rawAudioSaved': False,
        'twoComputerNoHeadphonesAcceptance': False,
        'at': datetime.now(timezone.utc).isoformat(),
    }
    print(json.dumps(result, indent=2))
    (ROOT / 'evidence').mkdir(exist_ok=True)
    (ROOT / 'evidence/aec-acoustic-local.json').write_text(json.dumps(result, indent=2) + '\n', encoding='utf-8')


if __name__ == '__main__': main()
