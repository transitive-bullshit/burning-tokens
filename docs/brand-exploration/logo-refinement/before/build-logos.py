#!/usr/bin/env python3
"""Build the Burning Tokens native logos from the reviewed vector geometry.

Default rebuild needs Python's standard library only.
--trace-reference additionally needs Pillow and NumPy and re-traces the
approved concept PNG read-only. It never modifies reference image pixels.
"""
from __future__ import annotations
import argparse
import json
import math
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
GEOMETRY = HERE / "build-logos.geometry.json"
OUT = HERE.parent / "logos"
COLORS = {"ink": "#151632", "cobalt": "#2447B8", "coral": "#FF7464", "gold": "#FFCC83", "cream": "#FFF0CF"}
REFERENCE = ROOT / "docs/brand-exploration/naming-concepts/burning-tokens-imagegen.png"

def polygon_area(points):
    return sum(x1*y2-x2*y1 for (x1,y1),(x2,y2) in zip(points,points[1:]+points[:1])) / 2

def simplify(points, tolerance=.7):
    if len(points) < 3:
        return points
    a, b = points[0], points[-1]
    dx,dy = b[0]-a[0],b[1]-a[1]
    length2 = dx*dx+dy*dy
    best,index = -1,0
    for i,p in enumerate(points[1:-1],1):
        t = max(0,min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/length2)) if length2 else 0
        distance = math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dy)
        if distance > best:
            best,index = distance,i
    if best > tolerance:
        return simplify(points[:index+1],tolerance)[:-1]+simplify(points[index:],tolerance)
    return [a,b]

def trace_edges(pixels):
    pixels = set(pixels)
    edges = {}
    def add(a,b):
        edges.setdefault(a,[]).append(b)
    for y,x in pixels:
        if (y-1,x) not in pixels: add((x,y),(x+1,y))
        if (y,x+1) not in pixels: add((x+1,y),(x+1,y+1))
        if (y+1,x) not in pixels: add((x+1,y+1),(x,y+1))
        if (y,x-1) not in pixels: add((x,y+1),(x,y))
    loops = []
    dirs = {(1,0):0,(0,1):1,(-1,0):2,(0,-1):3}
    while edges:
        start = next(iter(edges))
        point = start
        previous_dir = None
        loop = []
        while True:
            loop.append(point)
            choices = edges[point]
            if previous_dir is None or len(choices)==1:
                nxt = choices[0]
            else:
                rank = {1:0,0:1,3:2,2:3}
                nxt = min(choices,key=lambda p: rank[(dirs[(p[0]-point[0],p[1]-point[1])]-previous_dir)%4])
            previous_dir = dirs[(nxt[0]-point[0],nxt[1]-point[1])]
            choices.remove(nxt)
            if not choices:
                del edges[point]
            point = nxt
            if point == start:
                break
        if abs(polygon_area(loop)) >= 35:
            middle = len(loop)//2
            loops.append(simplify(loop[:middle+1])[:-1]+simplify(loop[middle:]+loop[:1])[:-1])
    return loops

def path_for(loops,xmin,ymin):
    commands = []
    def n(v):
        return str(round(v,2)).rstrip("0").rstrip(".") if v != int(v) else str(int(v))
    def xy(p):
        return n(p[0]-xmin)+" "+n(p[1]-ymin)
    for points in loops:
        corners = []
        for i,p in enumerate(points):
            prev,nxt = points[i-1],points[(i+1)%len(points)]
            v1 = (prev[0]-p[0],prev[1]-p[1])
            v2 = (nxt[0]-p[0],nxt[1]-p[1])
            l1,l2 = math.hypot(*v1),math.hypot(*v2)
            dot = (v1[0]*v2[0]+v1[1]*v2[1])/(l1*l2)
            trim = 0 if dot > .4 else min(1.2,l1*.22,l2*.22)
            before = (p[0]+v1[0]*trim/l1,p[1]+v1[1]*trim/l1)
            after = (p[0]+v2[0]*trim/l2,p[1]+v2[1]*trim/l2)
            corners.append((before,p,after,trim))
        commands.append("M "+xy(corners[0][2]))
        for before,p,after,trim in corners[1:]+corners[:1]:
            commands.append("L "+xy(before))
            if trim:
                commands.append("Q "+xy(p)+" "+xy(after))
        commands.append("Z")
    return " ".join(commands)

def retrace():
    import numpy as np
    from PIL import Image, ImageFilter
    image = np.array(Image.open(REFERENCE).convert("RGB"))[:310,280:1310].astype(float)
    red,green,blue = image[:,:,0],image[:,:,1],image[:,:,2]
    mask = (red>175)&(red>blue*1.17)&((red>green*1.08)|(green>145))
    mask = np.array(Image.fromarray((mask*255).astype("uint8")).filter(ImageFilter.MaxFilter(3)).filter(ImageFilter.MinFilter(3)))>0
    height,width = mask.shape
    seen = np.zeros_like(mask)
    components = []
    for y,x in zip(*np.where(mask)):
        if seen[y,x]:
            continue
        queue = [(int(y),int(x))]
        seen[y,x] = True
        pixels = []
        while queue:
            yy,xx = queue.pop()
            pixels.append((yy,xx+280))
            for ny,nx in [(yy-1,xx),(yy+1,xx),(yy,xx-1),(yy,xx+1)]:
                if 0<=ny<height and 0<=nx<width and mask[ny,nx] and not seen[ny,nx]:
                    seen[ny,nx] = True
                    queue.append((ny,nx))
        ys,xs = zip(*pixels)
        box = [min(xs),min(ys),max(xs)+1,max(ys)+1]
        star = len(pixels)>300 and box[1]<55 and 620<=box[0]<=820 and box[3]<105
        if len(pixels)>1000 or star:
            components.append({"box":box,"pixels":pixels,"kind":"accent" if star else "letter"})
    assert sum(c["kind"]=="letter" for c in components)==13
    assert sum(c["kind"]=="accent" for c in components)==2
    xmin,ymin = min(c["box"][0] for c in components),min(c["box"][1] for c in components)
    xmax,ymax = max(c["box"][2] for c in components),max(c["box"][3] for c in components)
    letters = []
    for i,component in enumerate(sorted(components,key=lambda c:(c["kind"],c["box"][0]))):
        loops = trace_edges(component["pixels"])
        letters.append({"id":component["kind"]+"-"+str(i+1).zfill(2),"source_box":component["box"],"contours":len(loops),"d":path_for(loops,xmin,ymin)})
    data = {
        "source":"docs/brand-exploration/naming-concepts/burning-tokens-imagegen.png",
        "method":"Read-only color separation; 3-pixel closing removes print grain; thirteen letter components and two stars; contour simplification 0.7 source pixels; corner rounding at most 1.2 source pixels; counters retained.",
        "visible_width":xmax-xmin,"visible_height":ymax-ymin,"padding":20,
        "wordmark":letters,
        "ribbon_main":"M 29 220 C 79 210 95 161 121 124 C 152 78 163 33 142 21 C 119 8 102 45 104 87 C 105 131 95 174 132 205 C 148 216 169 221 202 223",
        "ribbon_secondary":"M 47 218 C 50 181 88 169 118 147 C 164 112 112 61 82 67 C 48 73 70 127 116 155 C 151 176 164 202 194 217",
        "ribbon_outer":"M 48 220 C 26 190 71 151 111 134 C 149 117 179 157 183 192 C 187 214 177 222 163 222",
        "favicon_main":"M 40 215 C 85 204 103 154 127 116 C 155 70 158 38 140 28 C 121 17 108 49 110 87 C 112 131 106 172 138 199 C 153 211 177 217 201 218",
        "favicon_secondary":"M 51 212 C 53 181 89 165 120 143 C 154 118 114 75 85 79 C 60 85 79 122 116 149 C 150 173 171 202 201 216"
    }
    GEOMETRY.write_text(json.dumps(data,indent=2)+"\n")
    print("Traced 13 letters and 2 stars:",[(p["id"],p["contours"]) for p in letters])

def gradient(name, reverse=False, height=None):
    stops = [(0,COLORS["cream"]),(.3,COLORS["gold"]),(.72,COLORS["coral"]),(1,COLORS["coral"])]
    if reverse:
        stops = [(0,COLORS["coral"]),(.5,COLORS["gold"]),(1,COLORS["cream"])]
    coordinates = 'gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="'+str(height)+'"' if height else 'x1="0" y1="0" x2="0" y2="1"'
    return '<linearGradient id="'+name+'" '+coordinates+'>'+''.join('<stop offset="'+str(offset)+'" stop-color="'+color+'"/>' for offset,color in stops)+'</linearGradient>'

def svg(title,viewbox,content,defs=""):
    return '<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" viewBox="'+viewbox+'" role="img" aria-label="'+title+'">\n<title>'+title+'</title>\n'+('<defs>'+defs+'</defs>\n' if defs else '')+content+'\n</svg>\n'

def build():
    data = json.loads(GEOMETRY.read_text())
    OUT.mkdir(parents=True,exist_ok=True)
    width,height = data["visible_width"]+40,data["visible_height"]+40
    for variant,color in [("sunset","url(#sunset)"),("cream",COLORS["cream"]),("ink",COLORS["ink"])]:
        paths = '\n'.join('<path id="'+p["id"]+'" d="'+p["d"]+'"/>' for p in data["wordmark"])
        body = '<g transform="translate(20 20)" fill="'+color+'" fill-rule="evenodd">\n'+paths+'\n</g>'
        (OUT/("wordmark-"+variant+".svg")).write_text(svg("Burning Tokens",f"0 0 {width} {height}",body,gradient("sunset",height=data["visible_height"]) if variant=="sunset" else ""))
    main,secondary = data["ribbon_main"],data["ribbon_secondary"]
    outer = data["ribbon_outer"]
    for variant,color in [("sunset","url(#ribbon)"),("cream",COLORS["cream"]),("ink",COLORS["ink"])]:
        mask = '<mask id="underpass" maskUnits="userSpaceOnUse" x="0" y="0" width="256" height="256"><rect width="256" height="256" fill="white"/><path d="'+main+'" fill="none" stroke="black" stroke-width="24" stroke-linecap="round"/></mask>'
        outer_mask = '<mask id="outer-underpass" maskUnits="userSpaceOnUse" x="0" y="0" width="256" height="256"><rect width="256" height="256" fill="white"/><path d="'+main+'" fill="none" stroke="black" stroke-width="24" stroke-linecap="round"/><path d="'+secondary+'" fill="none" stroke="black" stroke-width="22" stroke-linecap="round"/></mask>'
        second_color = "url(#ribbon-return)" if variant=="sunset" else color
        body = '<g fill="none" stroke-linecap="round" stroke-linejoin="round"><path id="outer-ribbon" d="'+outer+'" stroke="'+color+'" stroke-width="12" mask="url(#outer-underpass)"/><path id="returning-ribbon" d="'+secondary+'" stroke="'+second_color+'" stroke-width="14" mask="url(#underpass)"/><path id="ascending-ribbon" d="'+main+'" stroke="'+color+'" stroke-width="15"/></g>'
        defs = mask+outer_mask+(gradient("ribbon")+gradient("ribbon-return",True) if variant=="sunset" else "")
        (OUT/("mark-"+variant+".svg")).write_text(svg("Burning Tokens ribbon mark","0 0 256 256",body,defs))
    main,secondary = data["favicon_main"],data["favicon_secondary"]
    body = '<rect width="256" height="256" rx="51" fill="'+COLORS["ink"]+'"/><g fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="'+secondary+'" stroke="'+COLORS["coral"]+'" stroke-width="22"/><path d="'+main+'" stroke="'+COLORS["ink"]+'" stroke-width="33"/><path d="'+main+'" stroke="url(#icon-ribbon)" stroke-width="23"/></g>'
    (OUT/"favicon.svg").write_text(svg("Burning Tokens","0 0 256 256",body,gradient("icon-ribbon")))
    print("Built 7 native SVGs; wordmark viewBox:",width,height)
    print("Palette:",COLORS)

if __name__=="__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--trace-reference",action="store_true")
    args = parser.parse_args()
    if args.trace_reference:
        retrace()
    build()
