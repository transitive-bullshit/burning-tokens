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


def dense_path_contours(path):
    """Sample existing native contours without rasterizing them."""
    import numpy as np
    import re
    tokens = re.findall(r"[MLQCZ]|-?\d+(?:\.\d+)?(?:e[-+]?\d+)?", path, flags=re.I)
    contours = []
    points = []
    current = None
    index = 0
    while index < len(tokens):
        command = tokens[index].upper()
        index += 1
        count = {"M":2,"L":2,"Q":4,"C":6,"Z":0}[command]
        values = np.array([float(v) for v in tokens[index:index+count]],dtype=float)
        index += count
        if command == "M":
            if points:
                contours.append(np.array(points))
            current = values
            points = [current.copy()]
        elif command == "Z":
            if len(points)>2:
                if np.linalg.norm(points[0]-points[-1])<.001:
                    points.pop()
                contours.append(np.array(points))
            points = []
        else:
            controls = [current]+list(values.reshape(-1,2))
            length = sum(np.linalg.norm(b-a) for a,b in zip(controls,controls[1:]))
            steps = max(2,int(math.ceil(length/.55)))
            for t in np.linspace(0,1,steps+1)[1:]:
                if command == "L":
                    point = (1-t)*controls[0]+t*controls[1]
                elif command == "Q":
                    point = (1-t)**2*controls[0]+2*(1-t)*t*controls[1]+t*t*controls[2]
                else:
                    point = (1-t)**3*controls[0]+3*(1-t)**2*t*controls[1]+3*(1-t)*t*t*controls[2]+t**3*controls[3]
                points.append(point)
            current = controls[-1]
    if points:
        contours.append(np.array(points))
    return contours

def uniform_closed(points,spacing=.65):
    import numpy as np
    points = np.vstack([points,points[0]])
    length = np.r_[0,np.cumsum(np.linalg.norm(np.diff(points,axis=0),axis=1))]
    keep = np.r_[True,np.diff(length)>.00001]
    points,length = points[keep],length[keep]
    samples = np.linspace(0,length[-1],max(20,int(length[-1]/spacing)),endpoint=False)
    return np.column_stack([np.interp(samples,length,points[:,axis]) for axis in range(2)]),length[-1]/len(samples)

def smooth_periodic(points,sigma):
    import numpy as np
    radius = int(math.ceil(sigma*3))
    offsets = np.arange(-radius,radius+1)
    weights = np.exp(-.5*(offsets/sigma)**2)
    weights /= weights.sum()
    return sum(weight*np.roll(points,int(offset),axis=0) for offset,weight in zip(offsets,weights))

def normalize(vector):
    import numpy as np
    length = np.linalg.norm(vector)
    return vector/length if length>1e-10 else np.array([1.,0.])

def bezier_at(curve,u):
    return (1-u)**3*curve[0]+3*(1-u)**2*u*curve[1]+3*(1-u)*u*u*curve[2]+u**3*curve[3]

def cubic_fit(points,start_tangent,end_tangent,tolerance=1.05,depth=0):
    """Least-squares cubic fitting with chord parameters and adaptive splitting."""
    import numpy as np
    if len(points)==2:
        distance = np.linalg.norm(points[-1]-points[0])/3
        return [np.array([points[0],points[0]+start_tangent*distance,points[-1]+end_tangent*distance,points[-1]])]
    distances = np.linalg.norm(np.diff(points,axis=0),axis=1)
    u = np.r_[0,np.cumsum(distances)]
    if u[-1]<1e-9:
        return []
    u /= u[-1]
    def generate(parameters):
        b0 = (1-parameters)**3
        b1 = 3*parameters*(1-parameters)**2
        b2 = 3*parameters**2*(1-parameters)
        b3 = parameters**3
        a0,a1 = b1[:,None]*start_tangent,b2[:,None]*end_tangent
        residual = points-(b0+b1)[:,None]*points[0]-(b2+b3)[:,None]*points[-1]
        matrix = np.array([[np.sum(a0*a0),np.sum(a0*a1)],[np.sum(a0*a1),np.sum(a1*a1)]])
        values = np.array([np.sum(a0*residual),np.sum(a1*residual)])
        try:
            alpha,beta = np.linalg.solve(matrix,values)
        except np.linalg.LinAlgError:
            alpha=beta=0
        chord = np.linalg.norm(points[-1]-points[0])
        if alpha<chord*.0001 or beta<chord*.0001 or max(alpha,beta)>max(chord*3,15):
            alpha=beta=chord/3
        return np.array([points[0],points[0]+start_tangent*alpha,points[-1]+end_tangent*beta,points[-1]])
    def error(curve,parameters):
        fitted = np.array([bezier_at(curve,t) for t in parameters])
        errors = np.sum((fitted-points)**2,axis=1)
        split = int(np.argmax(errors))
        return float(errors[split]),split
    curve = generate(u)
    maximum,split = error(curve,u)
    if maximum<=tolerance*tolerance:
        return [curve]
    if maximum<=tolerance*tolerance*16:
        for _ in range(4):
            first = 3*np.diff(curve,axis=0)
            second = 2*np.diff(first,axis=0)
            updated = []
            for point,t in zip(points,u):
                q = bezier_at(curve,t)
                q1 = (1-t)**2*first[0]+2*(1-t)*t*first[1]+t*t*first[2]
                q2 = (1-t)*second[0]+t*second[1]
                denominator = np.dot(q1,q1)+np.dot(q-point,q2)
                updated.append(min(1,max(0,t-np.dot(q-point,q1)/denominator)) if abs(denominator)>1e-9 else t)
            candidate = np.array(updated)
            if np.any(np.diff(candidate)<=0):
                break
            u = candidate
            curve = generate(u)
            maximum,split = error(curve,u)
            if maximum<=tolerance*tolerance:
                return [curve]
    split = max(1,min(len(points)-2,split))
    tangent = normalize(points[split+1]-points[split-1])
    return cubic_fit(points[:split+1],start_tangent,-tangent,tolerance,depth+1)+cubic_fit(points[split:],tangent,end_tangent,tolerance,depth+1)

def fitted_contour(points):
    import numpy as np
    raw,spacing = uniform_closed(points)
    coarse = smooth_periodic(raw,1.25/spacing)
    clean = smooth_periodic(raw,2.8/spacing)
    count = len(raw)
    reach = max(3,round(6/spacing))
    before = coarse-np.roll(coarse,reach,axis=0)
    after = np.roll(coarse,-reach,axis=0)-coarse
    angle = np.abs(np.arctan2(before[:,0]*after[:,1]-before[:,1]*after[:,0],np.sum(before*after,axis=1)))
    candidates = np.where(angle>math.radians(66))[0]
    candidates = sorted(candidates,key=lambda i:-angle[i])
    corners = []
    separation = max(5,round(13/spacing))
    for candidate in candidates:
        if all(min(abs(candidate-k),count-abs(candidate-k))>separation for k in corners):
            corners.append(int(candidate))
    for corner in corners:
        distance = np.minimum((np.arange(count)-corner)%count,(corner-np.arange(count))%count)*spacing
        weight = np.exp(-.5*(distance/3.5)**2)
        clean += weight[:,None]*(coarse[corner]-clean[corner])
    # Preserve each contour's overall proportions and counter size.
    for axis in range(2):
        oldmin,oldmax = raw[:,axis].min(),raw[:,axis].max()
        newmin,newmax = clean[:,axis].min(),clean[:,axis].max()
        if newmax-newmin>1e-8:
            clean[:,axis] = oldmin+(clean[:,axis]-newmin)*(oldmax-oldmin)/(newmax-newmin)
    if not corners:
        corners = [int(np.argmin(clean[:,0])),int(np.argmax(clean[:,0]))]
    if len(corners)==1:
        corners.append((corners[0]+count//2)%count)
    corners = sorted(set(corners))
    curves = []
    for start,end in zip(corners,corners[1:]+[corners[0]+count]):
        indices = np.arange(start,end+1)%count
        segment = clean[indices]
        span = min(5,max(1,len(segment)//6))
        t0 = normalize(segment[span]-segment[0])
        t1 = normalize(segment[-span-1]-segment[-1])
        curves.extend(cubic_fit(segment,t0,t1))
    def number(value):
        return str(round(float(value),2)).rstrip("0").rstrip(".") if round(float(value),2)%1 else str(int(round(float(value),2)))
    def pair(point):
        return number(point[0])+" "+number(point[1])
    if not curves:
        return "",0
    path = "M "+pair(curves[0][0])+" "+" ".join("C "+pair(c[1])+" "+pair(c[2])+" "+pair(c[3]) for c in curves)+" Z"
    return path,len(curves)

def clean_star(source_box,origin_x=294,origin_y=17):
    """Keep the source accent's extent; use four/eight intentional curved rays."""
    x0,y0,x1,y1 = source_box
    cx,cy = (x0+x1)/2-origin_x,(y0+y1)/2-origin_y
    rx,ry = (x1-x0)/2,(y1-y0)/2
    rays = 8 if x1-x0>45 else 4
    tips = []
    for i in range(rays):
        angle = -math.pi/2+i*math.tau/rays
        factor = .44 if rays==8 and i%2 else 1
        tips.append((cx+math.cos(angle)*rx*factor,cy+math.sin(angle)*ry*factor))
    parts = ["M "+str(round(tips[0][0],2))+" "+str(round(tips[0][1],2))]
    for i,tip in enumerate(tips):
        nxt = tips[(i+1)%rays]
        angle = -math.pi/2+(i+.5)*math.tau/rays
        valley = (cx+math.cos(angle)*(3.7 if rays==8 else 4.4),cy+math.sin(angle)*(3.7 if rays==8 else 4.4))
        a = (tip[0]+.91*(valley[0]-tip[0]),tip[1]+.91*(valley[1]-tip[1]))
        b = (nxt[0]+.91*(valley[0]-nxt[0]),nxt[1]+.91*(valley[1]-nxt[1]))
        parts.append("C "+" ".join(str(round(v,2)) for point in (a,b,nxt) for v in point))
    return " ".join(parts)+" Z"


def refine_selected_terminals(data):
    """Two deliberately drawn terminal spans replace print damage in the trace."""
    import re
    def replace_span(path,start,end,replacement):
        commands = re.findall(r"[MCZ][^MCZ]*",path)
        def endpoint(command):
            numbers = [float(v) for v in re.findall(r"-?\d+(?:\.\d+)?",command)]
            return numbers[-2:] if len(numbers)>1 else None
        beginning = next(i for i,c in enumerate(commands) if endpoint(c) and math.dist(endpoint(c),start)<.2)
        ending = next(i for i,c in enumerate(commands[beginning+1:],beginning+1) if endpoint(c) and math.dist(endpoint(c),end)<.2)
        return " ".join(c.strip() for c in commands[:beginning+1]+replacement+commands[ending+1:])
    for item in data["wordmark"]:
        if item["id"]=="letter-03":
            item["d"] = replace_span(item["d"],(34.78,283.97),(12.49,206.33),[
                "C 28.1 281.2 24.2 265.3 20.7 252",
                "C 17.2 238.3 7.9 224.4 12.49 206.33"
            ])
        elif item["id"]=="letter-10":
            item["d"] = replace_span(item["d"],(647.67,216.36),(553.01,193.15),[
                "C 630.5 219.8 601 218.8 579 211.6",
                "C 567.8 207.9 555.9 201.1 553.01 193.15"
            ])
        item["curve_segments"] = item["d"].count("C")
    return data

def smooth_geometry(data):
    """Remove traced print texture while retaining the original letter design."""
    import copy
    result = copy.deepcopy(data)
    total = 0
    for item in result["wordmark"]:
        if item["id"].startswith("accent"):
            item["d"] = clean_star(item["source_box"])
            item["curve_segments"] = item["d"].count("C")
        else:
            paths = []
            segments = 0
            for points in dense_path_contours(item["d"]):
                path,count = fitted_contour(points)
                paths.append(path)
                segments += count
            item["d"] = " ".join(paths)
            item["curve_segments"] = segments
        total += item["curve_segments"]
    result = refine_selected_terminals(result)
    total = sum(item["curve_segments"] for item in result["wordmark"])
    result["method"] = "Smooth native cubic revision: arclength resampling; 2.8-source-pixel periodic Gaussian filtering with multi-scale cusp anchors; recursive least-squares cubic Bezier fitting at 1.05 source pixels; original extents, counters, letter rhythm, and thirteen letter IDs preserved; two hand-refined curved star accents; B lower terminal and T lower sweep redrawn as continuous cubic spans to remove residual print damage."
    result["native_curve_segments"] = total
    print("Fitted cubic segments:",[(item["id"],item["curve_segments"]) for item in result["wordmark"]])
    return result

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
    data = smooth_geometry(data)
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

def build(wordmarks_only=False):
    data = json.loads(GEOMETRY.read_text())
    OUT.mkdir(parents=True,exist_ok=True)
    width,height = data["visible_width"]+40,data["visible_height"]+40
    for variant,color in [("sunset","url(#sunset)"),("cream",COLORS["cream"]),("ink",COLORS["ink"])]:
        paths = '\n'.join('<path id="'+p["id"]+'" d="'+p["d"]+'"/>' for p in data["wordmark"])
        body = '<g transform="translate(20 20)" fill="'+color+'" fill-rule="evenodd">\n'+paths+'\n</g>'
        (OUT/("wordmark-"+variant+".svg")).write_text(svg("Burning Tokens",f"0 0 {width} {height}",body,gradient("sunset",height=data["visible_height"]) if variant=="sunset" else ""))
    if wordmarks_only:
        print("Built 3 native wordmarks")
        return
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
    parser.add_argument("--geometry",type=Path)
    parser.add_argument("--output-dir",type=Path)
    parser.add_argument("--wordmarks-only",action="store_true")
    parser.add_argument("--smooth-source",type=Path)
    args = parser.parse_args()
    if args.geometry:
        GEOMETRY = args.geometry
    if args.output_dir:
        OUT = args.output_dir
    if args.smooth_source:
        data = smooth_geometry(json.loads(args.smooth_source.read_text()))
        GEOMETRY.write_text(json.dumps(data,indent=2)+"\n")
    if args.trace_reference:
        retrace()
    build(wordmarks_only=args.wordmarks_only)
