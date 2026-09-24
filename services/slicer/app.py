import os, tempfile, subprocess, zipfile, re
from flask import Flask, request, jsonify
app=Flask(__name__)
ALLOWED={"PLA","PETG","ABS","ASA","PA"}
PROFILES={"standard":"standard","strong":"strong","max":"max"}
BAMBU=os.getenv("BAMBU_STUDIO_BIN","/opt/bambu/BambuStudio")
CFG=os.getenv("SITRO_PROFILE_DIR","/app/profiles")
BBL=os.getenv("BAMBU_PROFILE_DIR","/opt/bambu/profiles/BBL")

def parse_slice_info(path):
    with zipfile.ZipFile(path) as z:
        names=z.namelist()
        target=next((n for n in names if n.endswith("Metadata/slice_info.config") or n.endswith("slice_info.config")),None)
        if not target: raise RuntimeError("slice_info.config not found")
        text=z.read(target).decode("utf-8","ignore")
    def val(keys):
        for k in keys:
            m=re.search(r'(?:key|name)=["\']'+re.escape(k)+r'["\'][^>]*value=["\']([^"\']+)',text,re.I)
            if m:
                try:return float(m.group(1))
                except:pass
        return None
    weight=val(["total_weight","filament_weight","total_filament_weight"])
    seconds=val(["prediction","print_time","total_time"])
    return weight,seconds

@app.get("/health")
def health(): return {"ok":True}

@app.post("/slice")
def slice_stl():
    f=request.files.get("file"); material=request.form.get("material","PLA").upper(); profile=request.form.get("profile","standard")
    if not f or not f.filename.lower().endswith(".stl"): return jsonify(error="STL file required"),400
    if material not in ALLOWED or profile not in PROFILES: return jsonify(error="Invalid material/profile"),400
    with tempfile.TemporaryDirectory() as td:
        src=os.path.join(td,"model.stl"); out=os.path.join(td,"out.gcode.3mf"); f.save(src)
        # Prefer SITRO flattened overrides when present. Official Bambu presets are bundled as the source of truth.
        machine=os.path.join(CFG,"machine.json"); process=os.path.join(CFG,profile+".json"); filament=os.path.join(CFG,"filament-"+material.lower()+".json")
        missing=[p for p in (machine,process,filament) if not os.path.exists(p)]
        if missing: return jsonify(error="SITRO flattened slicer profiles are not generated yet",missing=[os.path.basename(x) for x in missing],officialProfileRoot=BBL),503
        cmd=[BAMBU,"--orient","--arrange","1","--load-settings",machine+";"+process,"--load-filaments",filament,"--slice","0","--debug","2","--export-3mf",out,src]
        try: cp=subprocess.run(cmd,capture_output=True,text=True,timeout=180)
        except subprocess.TimeoutExpired: return jsonify(error="Slicer timeout"),504
        if cp.returncode!=0 or not os.path.exists(out): return jsonify(error="Slicer failed",detail=(cp.stderr or cp.stdout)[-1200:]),502
        weight,secs=parse_slice_info(out)
        if not weight or not secs: return jsonify(error="Slicer output missing weight/time"),502
        return jsonify(ok=True,totalWeightGrams=weight,printTimeSeconds=secs,material=material,profile=profile)
if __name__=="__main__": app.run(host="0.0.0.0",port=int(os.getenv("PORT","8080")))
