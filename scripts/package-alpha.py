"""Genera el ZIP distribuible a partir de los archivos del manifiesto verificado."""
import hashlib
import json
import re
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile

root = Path(__file__).resolve().parent.parent
dist = root / "dist"
manifest_path = dist / "release.json"
manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
version = manifest["sdk"]["version"]
if not re.fullmatch(r"\d+\.\d+\.\d+-alpha\.\d+", version):
    raise SystemExit("Compila una versión alfa antes de empaquetar.")
artifact = root / "artifacts" / f"webar-facil-v{version}.zip"
artifact.parent.mkdir(exist_ok=True)
temporary = artifact.with_suffix(".zip.tmp")

with ZipFile(temporary, "w", compression=ZIP_DEFLATED) as archive:
    for entry in manifest["files"]:
        source = (dist / entry["path"]).resolve()
        content = source.read_bytes() if source.is_relative_to(dist) else b""
        if len(content) != entry["bytes"] or hashlib.sha256(content).hexdigest() != entry["sha256"]:
            raise SystemExit(f"Archivo de distribución inválido: {entry['path']}")
        archive.writestr("dist/" + entry["path"], content)
    archive.write(manifest_path, "dist/release.json")
    for name in ("LICENSE", "THIRD_PARTY_NOTICES.md"):
        archive.write(root / name, name)

with ZipFile(temporary) as archive:
    if archive.testzip() is not None:
        raise SystemExit("El ZIP generado no es válido.")
temporary.replace(artifact)
digest = hashlib.sha256(artifact.read_bytes()).hexdigest()
artifact.with_suffix(".zip.sha256").write_text(f"{digest}  {artifact.name}\n", encoding="ascii")
print(f"{artifact.name} · {manifest['sdk']['build']} · SHA-256 {digest}")
