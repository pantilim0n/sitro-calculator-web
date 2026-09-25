#!/usr/bin/env python3
import json, os, sys, glob

ROOT=os.getenv("BAMBU_PROFILE_DIR","/opt/bambu/profiles/BBL")
OUT=os.getenv("SITRO_PROFILE_DIR","/app/profiles")

def load(p):
    with open(p,encoding="utf-8") as f:return json.load(f)

def all_json(kind):
    return glob.glob(os.path.join(ROOT,kind,"**","*.json"),recursive=True)

def index(kind):
    idx={}
    for p in all_json(kind):
        try:
            d=load(p)
            for k in (d.get("name"),d.get("id"),os.path.splitext(os.path.basename(p))[0]):
                if k: idx[k]=p
        except: pass
    return idx

def flatten(path,idx,seen=None):
    seen=set() if seen is None else seen
    d=load(path); key=d.get("name") or path
    if key in seen: raise RuntimeError("inheritance cycle: "+key)
    seen.add(key)
    parent=d.get("inherits")
    base={}
    if parent:
        pp=idx.get(parent)
        if not pp: raise RuntimeError(f"parent preset not found: {parent}")
        base=flatten(pp,idx,seen)
    base.update({k:v for k,v in d.items() if k!="inherits"})
    base["from"]="User"
    return base

def pick(kind, needles):
    paths=all_json(kind)
    for needle in needles:
        n=needle.lower()
        for p in paths:
            if n in os.path.basename(p).lower(): return p
    raise RuntimeError(f"{kind} preset not found: {needles}")

def write(name,data):
    os.makedirs(OUT,exist_ok=True)
    with open(os.path.join(OUT,name),"w",encoding="utf-8") as f:json.dump(data,f,ensure_ascii=False,indent=2)

mi,pi,fi=index("machine"),index("process"),index("filament")
machine=flatten(pick("machine",["Bambu Lab P1S 0.4 nozzle"]),mi)
write("machine.json",machine)

baseproc=flatten(pick("process",["0.20mm Standard @BBL P1P","0.20mm Standard @BBL X1C"]),pi)
profiles={
 "standard":{"wall_loops":"3","sparse_infill_density":"15%"},
 "strong":{"wall_loops":"4","sparse_infill_density":"25%"},
 "max":{"wall_loops":"6","sparse_infill_density":"40%"},
}
for name,ov in profiles.items():
    p=dict(baseproc);p.update(ov);p["name"]="SITRO "+name;p["from"]="User";write(name+".json",p)

filaments={
 "pla":["Bambu PLA Basic"],
 "petg":["Bambu PETG HF","Generic PETG"],
 "abs":["Bambu ABS","Generic ABS"],
 "asa":["Bambu ASA","Generic ASA"],
 "pa":["Bambu PA6-GF","Generic PA"],
}
for out,needles in filaments.items():
    try:f=flatten(pick("filament",needles),fi)
    except Exception as e:
        print("WARN",out,e,file=sys.stderr);continue
    f["name"]="SITRO "+out.upper();f["from"]="User";write("filament-"+out+".json",f)
print("Generated:",", ".join(sorted(os.listdir(OUT))))
