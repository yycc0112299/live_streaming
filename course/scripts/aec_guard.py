"""Keep the upstream's internal inference fallback from sending raw mic audio to OBS."""


def guard_inference(chain):
    for interpreter in [chain.dtln.pair.i1, chain.dtln.pair.i2]:
        for name in ['set_tensor', 'invoke', 'get_tensor']:
            original = getattr(interpreter, name)

            def checked(*args, _original=original, **kwargs):
                try:
                    return _original(*args, **kwargs)
                except Exception:
                    chain.last_error = 'AEC inference failed; raw microphone output is blocked'
                    raise

            setattr(interpreter, name, checked)
