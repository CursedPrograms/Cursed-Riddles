import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import main  # noqa: E402


def test_hello_world():
    code = main.encode_bf("Hello, World!")
    assert main.run_bf(code) == "Hello, World!"


def test_link():
    with open(os.path.join(main.HERE, "link.bf"), encoding="utf-8") as f:
        assert main.run_bf(f.read()) == "cursed-entertainment.itch.io"


def test_every_riddle_runs():
    data = main.load_riddles()
    assert len(data["riddles"]) >= 10
    for r in data["riddles"]:
        with open(os.path.join(main.RIDDLES, r["file"]), encoding="utf-8") as f:
            text = main.run_bf(f.read())
        assert text.endswith("?")
        assert main.run_bf(r["hint"])
        assert main.run_bf(r["reveal"])
        assert all(len(h) == 64 for h in r["answers"])


def test_normalise():
    assert main.normalise("  An Echo! ") == "echo"
    assert main.normalise("The letter M") == "letterm"
