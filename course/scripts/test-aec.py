"""Exercise the pinned upstream AEC Client engine on synthetic audio, without opening devices."""
import json
import os
import sys
import time
from pathlib import Path

import numpy as np

root = Path(__file__).resolve().parents[1]
upstream = root / '.runtime/aec/web/AEC-Web-v1.13.1-win64'
sys.path.insert(0, str(upstream))
os.chdir(upstream)  # LiteRT on Windows needs ASCII model filenames; preserve a relative path.
from web.chain import Chain
from web.dsp import FRAME_SIZE

rate = 16000
seconds = 12
t = np.arange(rate * seconds) / rate
rng = np.random.default_rng(9)


def speech_like(frequency):
    phase = 2 * np.pi * (frequency * t + 2 * np.sin(2 * np.pi * 0.7 * t))
    voiced = sum(np.sin(harmonic * phase) / harmonic for harmonic in range(1, 12))
    envelope = np.maximum(0, np.sin(2 * np.pi * 1.7 * t)) * (0.6 + 0.4 * np.cos(2 * np.pi * 0.3 * t))
    return (0.15 * voiced * envelope + 0.005 * rng.standard_normal(len(t))).astype(np.float32)


reference = speech_like(160)
near = speech_like(231)
delay = 720
echo = np.zeros_like(reference)
echo[delay:] = reference[:-delay] * 0.65
echo[delay + 160:] += reference[:-(delay + 160)] * 0.2


def process(mic, ref, engine='dtln'):
    chain = Chain(model_dir='models', num_threads=2)
    assert chain.set_ns_backend('off'), chain.last_error
    if engine != 'dtln':
        assert chain.set_engine(engine), chain.last_error
    assert chain.start(), chain.last_error
    assert chain.state()['dtlnBackend'] > 0, 'AEC models must load; passthrough is a failure'
    output = []
    for i in range(0, len(mic), FRAME_SIZE):
        m = np.clip(mic[i:i + FRAME_SIZE] * 32767, -32768, 32767).astype(np.int16)
        r = np.clip(ref[i:i + FRAME_SIZE] * 32767, -32768, 32767).astype(np.int16)
        output.append(chain.process_frame(m, r))
    assert not chain.state()['error'], chain.state()['error']
    chain.stop()
    return np.concatenate(output).astype(np.float32) / 32768


def energy(signal):
    return float(np.mean(np.square(signal[rate * 4:]))) + 1e-12


start = time.perf_counter()
cancelled = process(echo, reference)
without_reference = process(echo, np.zeros_like(reference))
near_output = process(near, np.zeros_like(reference))
double_talk = process(echo + near, reference)
echo_reduction = 10 * np.log10(energy(echo) / energy(cancelled))
reference_benefit = 10 * np.log10(energy(without_reference) / energy(cancelled))
near_gain = 10 * np.log10(energy(near_output) / energy(near))
near_window = near[rate * 4:rate * 10]
correlations = [float(np.corrcoef(near_window, double_talk[rate * 4 + lag:rate * 10 + lag])[0, 1]) for lag in range(0, 1025, 8)]
double_talk_correlation = max(correlations)
result = {
    'engine': 'AEC Client v1.13.1 DTLN-AEC 128; upstream code and models, NS disabled',
    'sourceCommit': 'f76ed632649723003e8778661d565523bdbd5732',
    'syntheticEchoReductionDb': round(float(echo_reduction), 2),
    'referenceBenefitDb': round(float(reference_benefit), 2),
    'nearOnlyGainDb': round(float(near_gain), 2),
    'doubleTalkNearSignalCorrelation': round(double_talk_correlation, 3),
    'secondsProcessed': seconds * 4,
    'elapsedSeconds': round(time.perf_counter() - start, 2),
    'physicalSpeakersAndMicrophones': False,
    'twoComputerNoHeadphonesAcceptance': False,
}
print(json.dumps(result, indent=2))
assert np.isfinite(double_talk).all()
assert echo_reduction >= 6, 'Synthetic echo reduction must reach 6 dB'
assert reference_benefit >= 3, 'Correct reference must outperform no reference by 3 dB'
assert -20 <= near_gain <= 6, 'Near-only voice-like signal must not be muted or amplified excessively'
assert double_talk_correlation >= 0.5, 'Near signal must remain identifiable while both sources are active'
result['passed'] = True
(root / 'evidence/aec-smoke.json').write_text(json.dumps(result, indent=2) + '\n', encoding='utf-8')
