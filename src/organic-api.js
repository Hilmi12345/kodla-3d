import { ORGANIC_API_VERSION } from './api-schema.js';

const finite = (value, label) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`${label} sonlu bir sayı olmalı.`);
  return value;
};
const positive = (value, label) => {
  finite(value, label);
  if (value <= 0) throw new Error(`${label} sıfırdan büyük olmalı.`);
  return value;
};
function vector(value, label) {
  if (!Array.isArray(value) || value.length !== 3) throw new Error(`${label} [x, y, z] biçiminde olmalı.`);
  return value.map((item, index) => finite(item, `${label}[${index}]`));
}
function boundsFor(center, radii) {
  return { min: center.map((v, i) => v - radii[i]), max: center.map((v, i) => v + radii[i]) };
}
function combineBounds(forms, padding = 0) {
  return {
    min: [0, 1, 2].map(axis => Math.min(...forms.map(form => form.bounds.min[axis])) - padding),
    max: [0, 1, 2].map(axis => Math.max(...forms.map(form => form.bounds.max[axis])) + padding)
  };
}
function smoothMax(a, b, width) {
  const h = Math.max(width - Math.abs(a - b), 0) / width;
  return Math.max(a, b) + h * h * width * 0.25;
}
function requireForm(value, label) {
  if (!value || typeof value.field !== 'function' || !value.bounds) throw new Error(`${label} bir organik parça olmalı.`);
  return value;
}

export class OrganikParca {
  constructor({ id, ad, field, bounds, nodes, transforms = [], visible = true, locked = false, children = [] }) {
    this.id = id;
    this.ad = ad || 'organik_model';
    this.field = field;
    this.bounds = bounds;
    this.nodes = nodes || [{ id, name: this.ad, type: 'mesh', visible, locked, transforms }];
    this.children = children;
    this.visible = visible;
    this.locked = locked;
    this.transforms = transforms;
  }
}

export function createOrganicAPI() {
  let generatedId = 0;
  const usedIds = new Set();
  function newId(requested) {
    let id=requested;
    if(id===undefined){do{id=`organic-part-${++generatedId}`;}while(usedIds.has(id));}
    if (typeof id !== 'string' || !id.trim()) throw new Error('Parça id boş olmayan bir metin olmalı.');
    if (usedIds.has(id)) throw new Error(`Parça id çakışması: "${id}". Her yeni parça için benzersiz id verin.`);
    usedIds.add(id);
    return id;
  }
  function makePart({ id, ad, field, bounds, type = 'mesh', sourceId = null, groupId = null, transforms = [], operations = [], parameters = {}, children = [], nodes, visible = true, locked = false }) {
    const partId = newId(id);
    const node = { id: partId, name: ad || partId, type, sourceId, groupId, visible, locked, transforms, operations, parameters, bounds };
    return new OrganikParca({ id: partId, ad, field, bounds, nodes: nodes || [...children.flatMap(child => child.nodes), node], children, transforms, visible, locked });
  }
  function derivedPart(parent, { ad = parent.ad, field = parent.field, bounds = parent.bounds, transforms = parent.transforms, operations = parent.nodes.at(-1)?.operations || [], visible = parent.visible, locked = parent.locked } = {}) {
    if (parent.locked) throw new Error(`Parça "${parent.ad}" kilitli; düzenleme yapılamaz.`);
    const nodes = parent.nodes.map(node => ({ ...node }));
    const leaf = nodes.at(-1);
    leaf.name = ad;
    leaf.bounds = bounds;
    leaf.transforms = transforms;
    leaf.operations = operations;
    leaf.visible = visible;
    leaf.locked = locked;
    return new OrganikParca({ id: parent.id, ad, field, bounds, nodes, children: parent.children, transforms, visible, locked });
  }
  function transformBounds(bounds, forward) {
    const points = [];
    for (let mask = 0; mask < 8; mask++) points.push(forward([0, 1, 2].map(axis => (mask & (1 << axis)) ? bounds.max[axis] : bounds.min[axis])));
    return { min: [0,1,2].map(axis => Math.min(...points.map(p => p[axis]))), max: [0,1,2].map(axis => Math.max(...points.map(p => p[axis]))) };
  }
  function rotationMatrix(angles) {
    const [x,y,z] = angles.map(value => finite(value, 'dönüş açısı') * Math.PI / 180);
    const cx=Math.cos(x),sx=Math.sin(x),cy=Math.cos(y),sy=Math.sin(y),cz=Math.cos(z),sz=Math.sin(z);
    return [[cz*cy,cz*sy*sx-sz*cx,cz*sy*cx+sz*sx],[sz*cy,sz*sy*sx+cz*cx,sz*sy*cx-cz*sx],[-sy,cy*sx,cy*cx]];
  }
  function rotatePoint(point, matrix) { return matrix.map(row => row.reduce((sum,value,index) => sum + value*point[index], 0)); }
  function transformPart(part, { tasima = [0,0,0], olcek = [1,1,1], aci = [0,0,0], pivot = [0,0,0] } = {}) {
    const translation=vector(tasima,'tasima'), scale=vector(olcek,'olcek'), center=vector(pivot,'pivot');
    if (scale.some(value => value === 0)) throw new Error('olcek eksenleri sıfır olamaz.');
    const matrix=rotationMatrix(vector(aci,'aci'));
    // Inverse transpose of the rotation matrix.
    const inverseMatrix=matrix[0].map((_,column)=>matrix.map(row=>row[column]));
    const evalInverse=(point)=>{
      const shifted=point.map((value,i)=>value-translation[i]-center[i]);
      const unrotated=rotatePoint(shifted,inverseMatrix);
      return unrotated.map((value,i)=>value/scale[i]+center[i]);
    };
    const forward=(point)=>{
      const scaled=point.map((value,i)=>(value-center[i])*scale[i]);
      return rotatePoint(scaled,matrix).map((value,i)=>value+center[i]+translation[i]);
    };
    const distanceScale=Math.min(...scale.map(Math.abs));
    const nextTransforms=[...part.transforms,{ tasima:translation, olcek:scale, aci, pivot:center, order:'scale->rotate->translate' }];
    const bounds=transformBounds(part.bounds,forward);
    return derivedPart(part,{field:p=>part.field(evalInverse(p))*distanceScale,bounds,transforms:nextTransforms});
  }

  function kure({ id, ad = 'kure', merkez = [0, 0, 0], yaricap = 10 } = {}) {
    const center = vector(merkez, 'merkez');
    const radius = positive(yaricap, 'yaricap');
    const padding = radius * 0.08;
    const bounds = boundsFor(center, [radius + padding, radius + padding, radius + padding]);
    return makePart({ id, ad, field: p => radius - Math.hypot(p[0] - center[0], p[1] - center[1], p[2] - center[2]), bounds, type: 'sphere', parameters: { center, radiusMm: radius } });
  }

  function elipsoid({ id, ad = 'elipsoid', merkez = [0, 0, 0], yariCaplar = [10, 8, 6] } = {}) {
    const center = vector(merkez, 'merkez');
    if (!Array.isArray(yariCaplar) || yariCaplar.length !== 3) throw new Error('yariCaplar [rx, ry, rz] olmalı.');
    const radii = yariCaplar.map((v, i) => positive(v, `yariCaplar[${i}]`));
    const padding = Math.max(...radii) * 0.08;
    const bounds = boundsFor(center, radii.map(radius => radius + padding));
    const field = p => {
      const q = p.map((v, i) => v - center[i]);
      const k0 = Math.hypot(...q.map((v, i) => v / radii[i]));
      const k1 = Math.hypot(...q.map((v, i) => v / (radii[i] * radii[i])));
      return k1 === 0 ? Math.min(...radii) : -k0 * (k0 - 1) / k1;
    };
    return makePart({ id, ad, field, bounds, type: 'ellipsoid', parameters: { center, radiiMm: radii } });
  }

  function kapsul({ id, ad = 'kapsul', baslangic, bitis, yaricap = 5, baslangicYaricapi = yaricap, bitisYaricapi = yaricap } = {}) {
    const a = vector(baslangic, 'baslangic');
    const b = vector(bitis, 'bitis');
    if (a.every((v, i) => v === b[i])) throw new Error('Kapsulun baslangic ve bitis noktaları farklı olmalı.');
    const rA = positive(baslangicYaricapi, 'baslangicYaricapi');
    const rB = positive(bitisYaricapi, 'bitisYaricapi');
    const ab = b.map((v, i) => v - a[i]);
    const lengthSquared = ab.reduce((sum, v) => sum + v * v, 0);
    const radius = Math.max(rA, rB);
    const bounds = {
      min: [0, 1, 2].map(i => Math.min(a[i], b[i]) - radius - radius * 0.08),
      max: [0, 1, 2].map(i => Math.max(a[i], b[i]) + radius + radius * 0.08)
    };
    const field = p => {
      const ap = p.map((v, i) => v - a[i]);
      const t = Math.max(0, Math.min(1, ap.reduce((sum, v, i) => sum + v * ab[i], 0) / lengthSquared));
      const nearest = a.map((v, i) => v + ab[i] * t);
      const localRadius = rA + (rB - rA) * t;
      return localRadius - Math.hypot(...p.map((v, i) => v - nearest[i]));
    };
    return makePart({ id, ad, field, bounds, type: 'capsule', parameters: { start: a, end: b, startRadiusMm: rA, endRadiusMm: rB } });
  }

  function yumusakBirlestir({ ad = 'yumusak_birlesim', parcalar = [], genislik = 2 } = {}) {
    if (!Array.isArray(parcalar) || parcalar.length < 2) throw new Error('Yumusak birlesim en az iki parca ister.');
    const forms = parcalar.map((value, i) => requireForm(value, `parcalar[${i}]`));
    const width = positive(genislik, 'genislik');
    // smoothMax her adımda en çok width/4 ekler; (n-1) adımlık zincir için kesin üst sınır budur.
    const bounds = combineBounds(forms, width * (forms.length - 1) * 0.25);
    // Culling: outside a form's bounds by more than `width`, its field is below -width, so it
    // cannot change smoothMax near the surface (|a-b| >= width there). Skipping it keeps the
    // zero level set exact; only far-away values (already negative) may differ.
    const boxes = forms.map(form => ({ min: form.bounds.min.map(v => v - width), max: form.bounds.max.map(v => v + width) }));
    const near = (box, p) => p[0] >= box.min[0] && p[0] <= box.max[0] && p[1] >= box.min[1] && p[1] <= box.max[1] && p[2] >= box.min[2] && p[2] <= box.max[2];
    const boxGap = (box, p) => Math.hypot(...p.map((v, i) => Math.max(box.min[i] - v, 0, v - box.max[i])));
    const field = p => {
      let distance = -Infinity;
      for (let i = 0; i < forms.length; i++) {
        if (!near(boxes[i], p)) continue;
        const value = forms[i].field(p);
        distance = distance === -Infinity ? value : smoothMax(distance, value, width);
      }
      if (distance !== -Infinity) return distance;
      // Far from every form: the nearest form's own field keeps the value distance-like
      // (a box-gap guess overestimates badly when bounds are loose, e.g. after rotation).
      let nearest = 0;
      for (let i = 1; i < forms.length; i++) if (boxGap(boxes[i], p) < boxGap(boxes[nearest], p)) nearest = i;
      return Math.min(forms[nearest].field(p), -width);
    };
    const ids = forms.flatMap(form => form.nodes.map(node => node.id));
    if (new Set(ids).size !== ids.length) throw new Error('Birleşimde yinelenen parça kimliği var; her kaynak parça benzersiz id taşımalı.');
    return makePart({ ad, field, bounds, type: 'smooth-union', parameters: { blendMm: width, sourceIds: forms.map(form => form.id) }, children: forms });
  }

  function yumusakCikar({ ad = 'yumusak_cikarma', ana, kesici, genislik = 2 } = {}) {
    const base = requireForm(ana, 'ana');
    const tool = requireForm(kesici, 'kesici');
    const width = positive(genislik, 'genislik');
    const field = p => -smoothMax(-base.field(p), tool.field(p), width);
    return makePart({ ad, field, bounds: base.bounds, type: 'smooth-subtraction', parameters: { blendMm: width, sourceIds: [base.id, tool.id] }, children: [base, tool] });
  }

  function composeGroup(groupId, ad, parcalar, reserve = true) {
    if (!Array.isArray(parcalar) || parcalar.length === 0) throw new Error('Grup en az bir parça ister.');
    parcalar.forEach(part=>requireForm(part,'parcalar öğesi'));
    const visible = parcalar.filter(part => part.visible);
    if (!visible.length) throw new Error('Grupta görünür parça yok.');
    const ids=parcalar.flatMap(part=>part.nodes.map(node=>node.id));
    if (new Set(ids).size !== ids.length) throw new Error('Parça id çakışması; farklı parçalar için benzersiz id kullanın.');
    const names=parcalar.map(part=>part.ad);
    if (new Set(names).size !== names.length || names.includes(ad)) throw new Error('Parça adı çakışması; grup içindeki adlar benzersiz olmalı.');
    if (reserve) groupId=newId(groupId);
    const bounds=combineBounds(visible);
    const field=p=>visible.reduce((value,part)=>Math.max(value,part.field(p)),-Infinity);
    const nodes=[...parcalar.flatMap(part=>part.nodes.map(node=>({...node,groupId:node.id===part.id?groupId:(node.groupId??groupId)}))),{id:groupId,name:ad,type:'group',sourceId:null,groupId:null,visible:true,locked:false,transforms:[],operations:[]}];
    return new OrganikParca({id:groupId,ad,field,bounds,nodes,children:parcalar});
  }

  function grup({ id, ad = 'grup', parcalar = [] } = {}) {
    return composeGroup(id,ad,parcalar,true);
  }

  function gorunum({ parca, gorunur = true, kilitli = parca?.locked ?? false } = {}) {
    requireForm(parca,'parca');
    const nodes=parca.nodes.map(node=>({...node}));
    nodes.at(-1).visible=Boolean(gorunur);nodes.at(-1).locked=Boolean(kilitli);
    return new OrganikParca({id:parca.id,ad:parca.ad,field:parca.field,bounds:parca.bounds,nodes,children:parca.children,transforms:parca.transforms,visible:Boolean(gorunur),locked:Boolean(kilitli)});
  }

  function tasi({ parca, x = 0, y = 0, z = 0 } = {}) { return transformPart(parca,{tasima:[x,y,z]}); }
  function donustur({ parca, tasima, olcek, aci, pivot } = {}) { return transformPart(parca,{tasima,olcek,aci,pivot}); }
  function simetrik({ parca, duzlem = 'YZ', konum = 0, ad = `${parca?.ad || 'parca'}_simetri`, id } = {}) {
    requireForm(parca,'parca');
    const axis={YZ:0,XZ:1,XY:2}[duzlem];
    if (axis === undefined) throw new Error('Simetri düzlemi XY, XZ veya YZ olmalı.');
    const offset=finite(konum,'simetri konumu');
    const scale=[1,1,1];scale[axis]=-1;
    const translation=[0,0,0];translation[axis]=2*offset;
    const reflected=transformPart(parca,{tasima:translation,olcek:scale});
    const cloneId=newId(id);
    const cloneNodes=reflected.nodes.map(node=>({...node,id:node.id===reflected.id?cloneId:`${cloneId}/${node.id}`,sourceId:node.id, name:node.id===reflected.id?ad:`${node.name}_ayna`, transforms:[...node.transforms,{mirrorPlane:duzlem,offset}]}));
    const clone=new OrganikParca({id:cloneId,ad,field:reflected.field,bounds:reflected.bounds,nodes:cloneNodes,children:reflected.children,transforms:reflected.transforms});
    return grup({ad:`${parca.ad} + ${ad}`,parcalar:[parca,clone]});
  }

  function parcaBul({ parca, id } = {}) {
    requireForm(parca,'parca');
    if(parca.id===id)return parca;
    for(const child of parca.children){try{return parcaBul({parca:child,id});}catch(error){if(!error.message.startsWith('Parça bulunamadı:'))throw error;}}
    throw new Error(`Parça bulunamadı: ${id}.`);
  }

  function parcaDegistir({ parca, id, yeniParca } = {}) {
    requireForm(parca,'parca');requireForm(yeniParca,'yeniParca');
    if(parca.id===id)throw new Error('Kök parçanın kendisini değiştirmek yerine yeniParca olarak döndürün.');
    const contains=(part,target)=>part.id===target||part.children.some(child=>contains(child,target));
    if(!contains(parca,id))throw new Error(`Parça bulunamadı: ${id}.`);
    const replace=(group)=>{
      if(!group.children.length)return group;
      let changed=false;
      const children=group.children.map(child=>{
        if(child.id===id){
          changed=true;if(child.locked)throw new Error(`Parça "${child.ad}" kilitli; düzenleme yapılamaz.`);
          const remap=node=>({...node,id:node.id===yeniParca.id?id:node.id});
          const nodes=yeniParca.nodes.map(remap);
          return new OrganikParca({id,ad:yeniParca.ad,field:yeniParca.field,bounds:yeniParca.bounds,nodes,children:yeniParca.children,transforms:yeniParca.transforms,visible:yeniParca.visible,locked:yeniParca.locked});
        }
        if(contains(child,id)){const next=replace(child);if(next!==child)changed=true;return next;}
        return child;
      });
      if(!changed)return group;
      return composeGroup(group.id,group.ad,children,false);
    };
    return replace(parca);
  }

  function bolgeselSekillendir({ parca, merkez, yaricap = 8, derinlik = 1, islem = 'sisir', yon = [0,0,1] } = {}) {
    requireForm(parca,'parca');
    const center=vector(merkez,'merkez'), radius=positive(yaricap,'yaricap'), amount=positive(derinlik,'derinlik');
    if (!['sisir','incelt','it','cek','yumusat'].includes(islem)) throw new Error('Bölgesel işlem sisir, incelt, it, cek veya yumusat olmalı.');
    const direction=vector(yon,'yon');const directionLength=Math.hypot(...direction);
    if ((islem==='it'||islem==='cek') && directionLength===0) throw new Error('it/cek işlemi için yon sıfır olamaz.');
    const normalized=directionLength?direction.map(value=>value/directionLength):[0,0,1];
    const compactFalloff=p=>{const t=Math.hypot(...p.map((value,i)=>value-center[i]))/radius;return t>=1?0:(1-t*t)**3;};
    let field;
    if (islem==='it'||islem==='cek') {
      const sign=islem==='it'?1:-1;
      field=p=>{const delta=sign*amount*compactFalloff(p);return parca.field(p.map((value,i)=>value-normalized[i]*delta));};
    } else if (islem==='yumusat') {
      field=p=>{
        const blend=0.65*compactFalloff(p);if(!blend)return parca.field(p);
        const offsets=[[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]];
        const average=offsets.reduce((sum,axis)=>sum+parca.field(p.map((value,i)=>value+axis[i]*amount)),0)/offsets.length;
        return parca.field(p)*(1-blend)+average*blend;
      };
    } else {
      const sign=islem==='sisir'?1:-1;
      field=p=>parca.field(p)+sign*amount*compactFalloff(p);
    }
    const padding=amount+amount*0.08;
    const bounds={min:parca.bounds.min.map(value=>value-padding),max:parca.bounds.max.map(value=>value+padding)};
    const operation={type:'regional-deform',islem,merkez:center,yaricapMm:radius,derinlikMm:amount,yon:normalized,falloff:'compact-cubic'};
    return derivedPart(parca,{field,bounds,operations:[...(parca.nodes.at(-1)?.operations||[]),operation]});
  }

  function egriDetayi({ hedef, noktalar, yaricap = 0.8, yaricaplar, etki = 'kabartma', genislik = 0.5, ad } = {}) {
    requireForm(hedef,'hedef');
    if (hedef.locked) throw new Error(`Parça "${hedef.ad}" kilitli; düzenleme yapılamaz.`);
    if (!Array.isArray(noktalar)||noktalar.length<2) throw new Error('Eğri detayı en az iki [x,y,z] noktası ister.');
    const points=noktalar.map((point,index)=>vector(point,`noktalar[${index}]`));
    const radii=yaricaplar===undefined?points.map(()=>positive(yaricap,'yaricap')):(()=>{if(!Array.isArray(yaricaplar)||yaricaplar.length!==points.length)throw new Error('yaricaplar uzunluğu noktalar ile eşleşmeli.');return yaricaplar.map((value,index)=>positive(value,`yaricaplar[${index}]`));})();
    if (!['kabartma','oyuk'].includes(etki)) throw new Error('Eğri detayı etki kabartma veya oyuk olmalı.');
    const blend=positive(genislik,'genislik');
    const segments=points.slice(0,-1).map((a,index)=>{
      const b=points[index+1],ab=b.map((value,i)=>value-a[i]),lengthSquared=ab.reduce((sum,value)=>sum+value*value,0);
      if(lengthSquared===0)throw new Error(`noktalar[${index}] ve noktalar[${index+1}] aynı olamaz.`);
      return {a,b,ab,lengthSquared,rA:radii[index],rB:radii[index+1]};
    });
    const curveField=p=>segments.reduce((best,segment)=>{
      const ap=p.map((value,i)=>value-segment.a[i]);const t=Math.max(0,Math.min(1,ap.reduce((sum,value,i)=>sum+value*segment.ab[i],0)/segment.lengthSquared));
      const nearest=segment.a.map((value,i)=>value+segment.ab[i]*t);const localRadius=segment.rA+(segment.rB-segment.rA)*t;
      return Math.max(best,localRadius-Math.hypot(...p.map((value,i)=>value-nearest[i])));
    },-Infinity);
    const toolBounds={min:[0,1,2].map(axis=>Math.min(...points.map(point=>point[axis]))-Math.max(...radii)-blend),max:[0,1,2].map(axis=>Math.max(...points.map(point=>point[axis]))+Math.max(...radii)+blend)};
    const bounds=etki==='kabartma'?combineBounds([hedef,{bounds:toolBounds}],blend):hedef.bounds;
    const field=etki==='kabartma'?p=>smoothMax(hedef.field(p),curveField(p),blend):p=>-smoothMax(-hedef.field(p),curveField(p),blend);
    const operation={type:'curve-detail',name:ad||'eğri-detayı',effect:etki,points,radiiMm:radii,blendMm:blend,actualGeometry:true};
    return derivedPart(hedef,{field,bounds,operations:[...(hedef.nodes.at(-1)?.operations||[]),operation]});
  }

  function gozKapagi({ hedef, noktalar, yaricap = 0.8, genislik = 0.6, ad = 'goz-kapagi' } = {}) { return egriDetayi({hedef,noktalar,yaricap,genislik,etki:'kabartma',ad}); }
  function dudakCizgisi({ hedef, noktalar, yaricap = 0.45, genislik = 0.4, ad = 'dudak-cizgisi' } = {}) { return egriDetayi({hedef,noktalar,yaricap,genislik,etki:'oyuk',ad}); }
  function yeleTutami({ hedef, noktalar, yaricap = 0.9, yaricaplar, genislik = 0.7, ad = 'yele-tutami' } = {}) { return egriDetayi({hedef,noktalar,yaricap,yaricaplar,genislik,etki:'kabartma',ad}); }
  function burunDeligi({ hedef, merkez, yariCaplar = [1.2,1.2,1.2], genislik = 0.2, ad = 'burun-deligi' } = {}) {
    requireForm(hedef,'hedef');
    const cutter=elipsoid({ad:`${ad}-kesici`,merkez,yariCaplar});
    const blend=positive(genislik,'genislik');
    const field=p=>-smoothMax(-hedef.field(p),cutter.field(p),blend);
    return derivedPart(hedef,{field,operations:[...(hedef.nodes.at(-1)?.operations||[]),{type:'surface-cavity',name:ad,center:vector(merkez,'merkez'),radiiMm:vector(yariCaplar,'yariCaplar'),blendMm:blend,actualGeometry:true}]});
  }

  return { apiVersion: ORGANIC_API_VERSION, OrganikParca, kure, elipsoid, kapsul, yumusakBirlestir, yumusakCikar, grup, gorunum, tasi, donustur, simetrik, parcaBul, parcaDegistir, bolgeselSekillendir, egriDetayi, gozKapagi, dudakCizgisi, yeleTutami, burunDeligi };
}



