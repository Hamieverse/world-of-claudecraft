// Builds hamie_poly.glb: a low-poly, flat-shaded ClaudeCraft-style variant of
// hamie.glb that matches the KayKit player-class look (simplified silhouette,
// faceted normals, posterized flat-color texture, no PBR maps, plain sword).
// Usage: node scripts/make_hamie_poly.mjs
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, normals, prune, simplify, unweld, weld } from '@gltf-transform/functions';
import { MeshoptSimplifier } from 'meshoptimizer';
import sharp from 'sharp';

const SRC = 'public/models/chars/players/hamie.glb';
const OUT = 'public/models/chars/players/hamie_poly.glb';

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(SRC);

// 1) Simplify the mesh toward KayKit territory (~15k tris down to ~4k).
await doc.transform(weld(), simplify({ simplifier: MeshoptSimplifier, ratio: 0.28, error: 0.02 }));

// 2) Flat shading: unweld so every face owns its vertices, then recompute
//    normals (per-face on unwelded geometry = faceted low-poly look).
await doc.transform(unweld(), normals({ overwrite: true }));

// 3) Posterize the diffuse to a chunky flat-color palette and drop it to 256px.
for (const tex of doc.getRoot().listTextures()) {
  const slots = tex.listParents().flatMap((p) => (p.propertyType === 'Root' ? [] : [p]));
  const isBaseColor = doc
    .getRoot()
    .listMaterials()
    .some((m) => m.getBaseColorTexture() === tex);
  if (!isBaseColor) continue;
  const png = await sharp(Buffer.from(tex.getImage()))
    .resize(256, 256, { kernel: 'nearest' })
    .median(9) // flatten painterly detail into blobs of color
    .modulate({ saturation: 1.25 })
    .png({ palette: true, colors: 14, dither: 0 })
    .toBuffer();
  tex.setImage(png).setMimeType('image/png');
  void slots;
}

// 4) Strip PBR maps + emissive glow; matte materials like the KayKit set.
for (const mat of doc.getRoot().listMaterials()) {
  mat.setNormalTexture(null);
  mat.setMetallicRoughnessTexture(null);
  mat.setOcclusionTexture(null);
  mat.setRoughnessFactor(1.0);
  mat.setMetallicFactor(0.0);
  mat.setEmissiveFactor([0, 0, 0]);
  const emissiveExt = mat.getExtension('KHR_materials_emissive_strength');
  if (emissiveExt) emissiveExt.dispose();
  if (mat.getName() === 'S_blade') mat.setBaseColorFactor([0.78, 0.81, 0.85, 1]); // plain steel
}

await doc.transform(prune(), dedup());
await io.write(OUT, doc);

const { statSync } = await import('node:fs');
console.log(`${OUT}: ${(statSync(OUT).size / 1024 / 1024).toFixed(2)} MB`);
