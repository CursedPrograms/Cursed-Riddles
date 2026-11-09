"""Cursed Riddles: riddles written in Brainfuck.

Every riddle in riddles/ is a Brainfuck program. Run it to read the riddle, then answer it.
Answers are stored only as salted SHA-256 hashes, so reading the files does not give them away.

    python main.py                 play the riddles in order
    python main.py run FILE.bf     run any Brainfuck program
    python main.py encode "text"   print a Brainfuck program that prints the text
    python main.py encrypt FILE.bf KEYFILE OUTFILE   encrypt a riddle (needs: pip install cryptography)
    python main.py decrypt INFILE KEYFILE OUTFILE.bf decrypt it again
"""
import hashlib
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
RIDDLES = os.path.join(HERE, "riddles")
PROGRESS = os.path.join(HERE, "progress.json")


# ---------- Brainfuck ----------
def run_bf(code, data="", max_steps=10_000_000):
    """Run a Brainfuck program and return what it prints."""
    code = [c for c in code if c in "+-<>[].,"]
    jumps, stack = {}, []
    for i, c in enumerate(code):
        if c == "[":
            stack.append(i)
        elif c == "]":
            if not stack:
                raise ValueError("unmatched ] at %d" % i)
            j = stack.pop()
            jumps[i], jumps[j] = j, i
    if stack:
        raise ValueError("unmatched [ at %d" % stack[-1])
    tape, ptr, pc, out, inp, steps = [0] * 30000, 0, 0, [], 0, 0
    while pc < len(code):
        c = code[pc]
        if c == ">":
            ptr = (ptr + 1) % len(tape)
        elif c == "<":
            ptr = (ptr - 1) % len(tape)
        elif c == "+":
            tape[ptr] = (tape[ptr] + 1) % 256
        elif c == "-":
            tape[ptr] = (tape[ptr] - 1) % 256
        elif c == ".":
            out.append(chr(tape[ptr]))
        elif c == ",":
            tape[ptr] = ord(data[inp]) % 256 if inp < len(data) else 0
            inp += 1
        elif c == "[" and tape[ptr] == 0:
            pc = jumps[pc]
        elif c == "]" and tape[ptr] != 0:
            pc = jumps[pc]
        pc += 1
        steps += 1
        if steps > max_steps:
            raise RuntimeError("program ran too long")
    return "".join(out)


def encode_bf(text, width=64):
    """Write a Brainfuck program that prints text (cell 0 is a loop counter, cell 1 the character)."""
    parts, cur = [], 0
    for ch in text:
        d = ord(ch) - cur
        best = "+" * d if d >= 0 else "-" * -d
        for a in range(2, 16):
            for b in range(2, 16):
                for sign in (1, -1):
                    rem = d - sign * a * b
                    code = "<" + "+" * a + "[>" + ("+" if sign > 0 else "-") * b + "<-]>" + ("+" * rem if rem >= 0 else "-" * -rem)
                    if len(code) < len(best):
                        best = code
        parts.append(best + ".")
        cur = ord(ch)
    code = ">" + "".join(parts)
    return "\n".join(code[i:i + width] for i in range(0, len(code), width))


# ---------- Answers ----------
def normalise(answer):
    s = re.sub(r"[^a-z0-9*]+", " ", answer.lower()).strip()
    s = re.sub(r"^(a|an|the) ", "", s)
    return s.replace(" ", "")


def answer_hash(salt, answer):
    return hashlib.sha256((salt + normalise(answer)).encode()).hexdigest()


def load_riddles():
    with open(os.path.join(RIDDLES, "riddles.json"), encoding="utf-8") as f:
        return json.load(f)


def load_progress():
    try:
        with open(PROGRESS, encoding="utf-8") as f:
            return set(json.load(f))
    except (OSError, ValueError):
        return set()


def save_progress(solved):
    with open(PROGRESS, "w", encoding="utf-8") as f:
        json.dump(sorted(solved), f)


# ---------- Game ----------
def play():
    data = load_riddles()
    salt, riddles = data["salt"], data["riddles"]
    solved = load_progress()
    print("CURSED RIDDLES - %d riddles written in Brainfuck. Type 'hint', 'skip' or 'quit'.\n" % len(riddles))
    for r in riddles:
        if r["id"] in solved:
            continue
        with open(os.path.join(RIDDLES, r["file"]), encoding="utf-8") as f:
            code = f.read()
        print("Riddle %d of %d (%s)" % (r["id"] + 1, len(riddles), r["file"]))
        print("  " + run_bf(code))
        while True:
            try:
                guess = input("> ").strip()
            except EOFError:
                return
            if not guess:
                continue
            if guess.lower() == "quit":
                return
            if guess.lower() == "hint":
                print("  Hint: " + run_bf(r["hint"]))
                continue
            if guess.lower() == "skip":
                print()
                break
            if answer_hash(salt, guess) in r["answers"]:
                print("  Correct: " + run_bf(r["reveal"]) + "\n")
                solved.add(r["id"])
                save_progress(solved)
                break
            print("  No. Try again, or type 'hint'.")
    print("Solved %d of %d riddles." % (len(solved), len(riddles)))


def crypt(mode, src, key_file, dst):
    try:
        from cryptography.fernet import Fernet
    except ImportError:
        sys.exit("encrypt/decrypt need the cryptography package: pip install cryptography")
    if mode == "encrypt" and not os.path.exists(key_file):
        with open(key_file, "wb") as f:
            f.write(Fernet.generate_key())
        print("New key saved to " + key_file)
    with open(key_file, "rb") as f:
        fernet = Fernet(f.read())
    with open(src, "rb") as f:
        blob = f.read()
    blob = fernet.encrypt(blob) if mode == "encrypt" else fernet.decrypt(blob)
    with open(dst, "wb") as f:
        f.write(blob)
    print("%sed %s -> %s" % (mode.capitalize(), src, dst))


def main(argv):
    if not argv:
        play()
    elif argv[0] == "run" and len(argv) == 2:
        with open(argv[1], encoding="utf-8") as f:
            print(run_bf(f.read()))
    elif argv[0] == "encode" and len(argv) == 2:
        print(encode_bf(argv[1]))
    elif argv[0] in ("encrypt", "decrypt") and len(argv) == 4:
        crypt(argv[0], argv[1], argv[2], argv[3])
    else:
        print(__doc__)


if __name__ == "__main__":
    main(sys.argv[1:])
