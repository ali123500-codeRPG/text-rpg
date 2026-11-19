"""Pack each skill in .agents/skills/ into dist/skills/<name>.zip, ready to upload to a Claude account.

Run from the repo root: `npm run skills-zip`. Each zip holds one folder, `<name>/`, with `SKILL.md` at its top,
which is the shape the upload under Customize > Skills expects. `dist/` is git-ignored.
"""
import pathlib, sys, zipfile

SRC = pathlib.Path('.agents/skills'); OUT = pathlib.Path('dist/skills')

def pack(skill):
    if not (skill / 'SKILL.md').is_file(): sys.exit(f'{skill}: no SKILL.md')
    target = OUT / f'{skill.name}.zip'
    with zipfile.ZipFile(target, 'w', zipfile.ZIP_DEFLATED) as z:
        for f in sorted(skill.rglob('*')):
            if f.is_file() and '__pycache__' not in f.parts: z.write(f, f.relative_to(SRC))
    return target

if __name__ == '__main__':
    if not SRC.is_dir(): sys.exit('run from the repo root')
    OUT.mkdir(parents=True, exist_ok=True)
    for skill in sorted(p for p in SRC.iterdir() if p.is_dir()): print(pack(skill))
