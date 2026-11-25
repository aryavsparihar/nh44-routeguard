# pytest (Python tests)

**In one line:** pytest tests the risk job's rules, weather parsing, backtest and replay, using saved sample data instead of live weather.

## What it is

pytest (version 9.2.0) is the standard Python test runner. A test is a function starting with `test_` that uses `assert`.

## Why we use it

- The risk rules decide what drivers see, so every trigger and score needs a test.
- Saved sample responses (`jobs/tests/fixtures/`) mean tests never call Open-Meteo, so they're fast and always give the same answer.

## Where it is in our project

| Path | What it tests |
| --- | --- |
| `jobs/tests/test_triggers.py` | Each hazard's weather trigger |
| `jobs/tests/test_scoring.py` | Exposure × trigger, levels, worst point wins |
| `jobs/tests/test_openmeteo.py` | Reading Open-Meteo answers and errors |
| `jobs/tests/test_reasons.py` | Every score has a valid reason code |
| `jobs/tests/test_job.py` | The whole job in dry-run mode |
| `jobs/tests/test_backtest.py`, `test_replay.py`, `test_validate_incidents.py` | The backtest, replay and incident data |
| `jobs/pytest.ini` | Settings |

On 26 Nov 2026: **154 tests**. CI runs them on every pull request with Python 3.12.

## Commands

```bash
pip install -r jobs/requirements.txt
python -m pytest jobs/tests -q
```

## Learn more

- https://docs.pytest.org/

## Questions you may be asked

**Q: How do you test weather code without real weather?**
A: We saved real Open-Meteo answers as files (fixtures) and feed those in, so the result is the same every time.

**Q: What does the backtest test prove?**
A: That the backtest code itself is right (the time windows and hit counting). The backtest's results are in `docs/backtest.md`.
