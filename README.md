  <br>
<div align="center">
  <a href="https://ko-fi.com/cursedentertainment">
    <img src="https://ko-fi.com/img/githubbutton_sm.svg" alt="ko-fi" style="width: 20%;"/>
  </a>
</div>
  <br>

# Cursed Riddles

Twelve riddles written in Brainfuck. Each riddle is a Brainfuck program: run it to read the riddle, then answer it. The answers are stored only as salted SHA-256 hashes, so reading the files does not give them away.

**Play in the browser:** [cursedprograms.github.io/Cursed-Riddles](https://cursedprograms.github.io/Cursed-Riddles/) (watch the program run on the tape, answer, take hints, and write your own Brainfuck in the playground).

## Play in a terminal

Python 3, nothing else to install:

```
python main.py                       # play the riddles in order (hint, skip, quit)
python main.py run riddles/riddle_00.bf
python main.py encode "your text"    # print a Brainfuck program that prints your text
python main.py encrypt riddle.bf riddle.key riddle.enc
python main.py decrypt riddle.enc riddle.key riddle.bf
```

Windows: `setup.bat` or `setup.ps1`. Linux and macOS: `./setup.sh`. Encrypt and decrypt use Fernet and need `pip install cryptography`.

## Files

- `riddles/riddle_00.bf` ... `riddle_11.bf` - the riddles
- `riddles/riddles.json` - answer hashes, hints and reveals (also in Brainfuck)
- `main.py` - interpreter, encoder and the terminal game
- `index.html`, `site/style.css`, `site/site.js` - the website
- `tests/` - `pytest` checks that every riddle runs

<br>
<div align="center">
© Cursed Entertainment
</div>
<br>
<div align="center">
<a href="https://cursed-entertainment.itch.io/" target="_blank">
    <img src="https://github.com/CursedPrograms/cursedentertainment/raw/main/images/logos/logo-wide-grey.png"
        alt="CursedEntertainment Logo" style="width:250px;">
</a>
</div>
