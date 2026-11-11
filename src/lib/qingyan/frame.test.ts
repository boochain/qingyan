import assert from "node:assert/strict";
import test from "node:test";
import { fitView, panBy, zoomAt } from "./canvas-math.ts";
import { canonicalChosen, gradeFrame, parseFrameText, regionHit } from "./frame.ts";
import { parseImport } from "./io.ts";
import { applyOps } from "./ops.ts";
import { emptyLibrary } from "./types.ts";

test("slots text frame grades aliases and misses", () => {
  const frame = parseFrameText(`@frame
type: 七选五
interaction: slots
unique: yes
stem: 河{{1}}谷
opt A: 穿过
opt B: 离开
key: 1=A
explain 1: 穿过
@end`);
  assert.equal(frame.typeName, "七选五");
  assert.equal(gradeFrame(frame, ["1=A"]).correct, true);
  assert.equal(gradeFrame(frame, ["1=B"]).correct, false);
  assert.equal(canonicalChosen(frame)[0], "1=A");
});

test("blank accepts a listed alias", () => {
  const frame = parseFrameText(`@frame
interaction: blanks
stem: {{1}}
key: 1=DNS|dns
explain 1: 名字
@end`);
  assert.equal(gradeFrame(frame, ["1=dns"]).correct, true);
  assert.equal(gradeFrame(frame, ["1=ARP"]).correct, false);
});

test("hotspot point hits the region and can be panned without a clamp", () => {
  const frame = parseFrameText(`@frame
interaction: hotspot
img: /cc/earth.png
region sa: 0.31,0.70,0.08
key: sa
@end`);
  assert.equal(regionHit(frame.regions[0]!, 0.33, 0.72), true);
  assert.equal(gradeFrame(frame, ["0.330,0.720"]).correct, true);
  assert.equal(gradeFrame(frame, ["0.900,0.100"]).correct, false);
  const fitted = fitView(1280, 640, 400, 800);
  const centered = panBy(fitted, 200 - (fitted.tx + 1280 * fitted.scale), 0);
  assert.equal(centered.tx + 1280 * centered.scale, 200);
  const zoomed = zoomAt(fitted, 40, 50, 2);
  const worldX = (40 - fitted.tx) / fitted.scale;
  assert.ok(Math.abs(40 - (zoomed.tx + worldX * zoomed.scale)) < 1e-6);
});

test("material question needs every sub", () => {
  const text = `@frame
interaction: material
stem: 材料
sub s1.interaction: choice
sub s1.stem: 问
sub s1.opt A: 甲
sub s1.opt B: 乙
sub s1.key: A
sub s1.explain A: 因为甲
sub s2.interaction: blanks
sub s2.stem: {{1}}
sub s2.key: 1=合法
@end`;
  const frame = parseFrameText(text);
  assert.equal(gradeFrame(frame, ["s1@A"]).correct, false);
  assert.equal(gradeFrame(frame, ["s1@A", "s2@1=合法"]).correct, true);
  const ops = parseImport(`# 临时\n## 章\n1. 材料题\n${text}\n`, "临时");
  assert.equal(ops.kind, "ops");
  const applied = applyOps(emptyLibrary(), ops.kind === "ops" ? ops.ops : []);
  const added = applied.library.questions.find((item) => item.stem.includes("材料题"));
  assert.equal(added?.type, "frame");
  assert.equal(added && gradeFrame(added.frame!, added.answer).correct, true);
});
