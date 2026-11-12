import type { Object3D, WebGLRenderer } from "three";

type Mode = "normal" | "pixels" | "base";
type Phase = "拖动" | "滚轮" | "停手后";
type Frame = { started: number; interval: number; submit: number; calls: number };
type TileWork = "瓦片视野更新" | "纹理上传";
type TimedWork = { startTime: number; duration: number };
type LongFrame = PerformanceEntry & {
  blockingDuration: number;
  scripts: ReadonlyArray<PerformanceEntry & { sourceURL: string; sourceFunctionName: string; invokerType: string }>;
};

const modeLabel: Record<Mode, string> = {
  normal: "正常画面",
  pixels: "约一半画布像素",
  base: "仅基础地球",
};

function p95(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  return Math.round(sorted[Math.ceil(sorted.length * 0.95) - 1] * 10) / 10;
}

function overlapsFrame(work: TimedWork, frame: Frame) {
  return work.startTime < frame.started && work.startTime + work.duration > frame.started - frame.interval;
}

function createGpuSampler(gl: WebGL2RenderingContext) {
  const ext = gl.getExtension("EXT_disjoint_timer_query_webgl2") as {
    TIME_ELAPSED_EXT: number;
    GPU_DISJOINT_EXT: number;
  } | null;
  if (!ext) return;
  const pending: { query: WebGLQuery; values: number[] }[] = [];
  let frames = 0;

  function collect(finishing = false) {
    if (!pending.length) return;
    const disjoint = gl.getParameter(ext.GPU_DISJOINT_EXT);
    while (pending.length) {
      const { query, values } = pending[0];
      const ready = !disjoint && gl.getQueryParameter(query, gl.QUERY_RESULT_AVAILABLE);
      if (!ready && !finishing && !disjoint) break;
      if (ready) values.push(gl.getQueryParameter(query, gl.QUERY_RESULT) / 1e6);
      gl.deleteQuery(query);
      pending.shift();
    }
  }

  return {
    begin(values: number[] | undefined) {
      if (frames++ % 6 !== 0) return;
      collect();
      if (!values || pending.length >= 3 || gl.isContextLost()) return;
      const query = gl.createQuery();
      if (!query) return;
      gl.beginQuery(ext.TIME_ELAPSED_EXT, query);
      pending.push({ query, values });
      return query;
    },
    end() {
      gl.endQuery(ext.TIME_ELAPSED_EXT);
    },
    finish() {
      collect(true);
      frames = 0;
    },
  };
}

export function installGlobePerformance(
  renderer: WebGLRenderer,
  getMotion: () => Phase | null,
  getTileLayers: () => [Object3D, Object3D | undefined],
) {
  const panel = document.createElement("section");
  panel.setAttribute("aria-label", "地球仪性能诊断");
  panel.style.cssText = "position:fixed;z-index:1200;right:24px;bottom:20px;width:min(360px,calc(100% - 48px));box-sizing:border-box;padding:16px;border:1px solid #555;border-radius:12px;background:#14171c;color:#fff;font:14px/1.5 system-ui";
  panel.innerHTML = `
    <strong>地球仪性能诊断</strong>
    <p>每次记录 8 秒。拖动地球，再按 Ctrl 连续滚轮缩放，停手约 1 秒。</p>
    <select aria-label="诊断模式">
      <option value="normal">正常画面</option>
      <option value="pixels">约一半画布像素</option>
      <option value="base">仅基础地球</option>
    </select>
    <button type="button" data-record>开始记录</button>
    <p role="status" data-status>先记录正常画面。对比模式请使用相同视角和动作。</p>
    <pre data-result style="white-space:pre-wrap;max-height:28vh;overflow:auto;font:12px/1.5 system-ui" hidden></pre>
    <button type="button" data-copy hidden>复制测试结果</button>
  `;
  document.body.append(panel);
  const select = panel.querySelector("select")!;
  const recordButton = panel.querySelector<HTMLButtonElement>("[data-record]")!;
  const status = panel.querySelector<HTMLElement>("[data-status]")!;
  const result = panel.querySelector<HTMLElement>("[data-result]")!;
  const copy = panel.querySelector<HTMLButtonElement>("[data-copy]")!;

  const results = new Map<Mode, string>();
  const render = renderer.render.bind(renderer);
  let recording: {
    mode: Mode;
    ratio: number;
    timer: ReturnType<typeof setTimeout>;
    previousAt: number;
    lastMotionAt: number;
    frames: Record<Phase, Frame[]>;
    gpu: Record<Phase, number[]>;
    tiles: Record<TileWork, TimedWork[]>;
    longFrames: LongFrame[];
  } | undefined;
  const gpu = createGpuSampler(renderer.getContext());
  const observer = typeof PerformanceObserver !== "undefined" &&
    PerformanceObserver.supportedEntryTypes.includes("long-animation-frame")
    ? new PerformanceObserver(list => recording?.longFrames.push(...list.getEntries() as LongFrame[]))
    : undefined;

  function finish(interrupted = false) {
    if (!recording) return;
    const { mode, ratio, timer, frames, gpu: gpuTimes, tiles, longFrames } = recording;
    if (observer) {
      longFrames.push(...observer.takeRecords() as LongFrame[]);
      observer.disconnect();
    }
    gpu?.finish();
    recording = undefined;
    clearTimeout(timer);
    if (mode === "pixels") renderer.setPixelRatio(ratio);
    select.disabled = recordButton.disabled = false;
    if (interrupted) {
      status.textContent = "页面进入后台，本次记录已作废。";
      return;
    }
    const rows = Object.entries(frames).filter(([, values]) => values.length).map(([phase, values]) =>
      `${phase} ${values.length} 帧 · 帧间隔 P95 ${p95(values.map(f => f.interval))}ms · 超 33ms ${values.filter(f => f.interval > 33.4).length} 帧 · 提交 P95 ${p95(values.map(f => f.submit))}ms · 绘制调用 P95 ${p95(values.map(f => f.calls))}`,
    );
    if (!rows.length) {
      status.textContent = "没有捕捉到拖动或缩放。请等地球仪加载完成后重试。";
      return;
    }
    const gpuRows = Object.entries(gpuTimes).filter(([, times]) => times.length).map(([phase, times]) =>
      `${phase} P95 ${p95(times)}ms（${times.length} 帧）`,
    );
    rows.push(gpuRows.length ? `GPU 绘制采样 · ${gpuRows.join(" · ")}` :
      gpu ? "GPU 绘制采样 · 无有效结果" : "GPU 绘制采样 · 浏览器不支持");
    const slowTail = frames["停手后"].filter(frame => frame.interval > 33.4);
    rows.push(...Object.entries(tiles).map(([name, samples]) => {
      const overlaps = slowTail.filter(frame => samples.some(work => overlapsFrame(work, frame))).length;
      const peak = samples.length ? ` · 最长 ${Math.max(...samples.map(work => work.duration)).toFixed(1)}ms` : "";
      return `${name} ${samples.length} 次${peak} · 重叠停手后慢帧 ${overlaps}/${slowTail.length}`;
    }));
    const tailLongFrames = longFrames.filter(work => slowTail.some(frame => overlapsFrame(work, frame)));
    rows.push(observer ? `停手后浏览器长帧（>50ms） ${tailLongFrames.length} 次` :
      "停手后浏览器长帧 · 浏览器不支持");
    for (const frame of tailLongFrames.sort((a, b) => b.duration - a.duration).slice(0, 3)) {
      const script = [...frame.scripts].sort((a, b) => b.duration - a.duration)[0];
      const file = script?.sourceURL?.split(/[?#]/, 1)[0].split("/").pop();
      const scriptLabel = script ? ` · 脚本 ${file || script.invokerType}${script.sourceFunctionName ? ` / ${script.sourceFunctionName}` : ""} ${script.duration.toFixed(1)}ms` : "";
      rows.push(`${frame.duration.toFixed(1)}ms · 主线程阻塞 ${frame.blockingDuration.toFixed(1)}ms${scriptLabel}`);
    }
    results.set(mode, `【${modeLabel[mode]}】\n${rows.join("\n")}`);
    result.textContent = [...results.values()].join("\n\n");
    result.hidden = copy.hidden = false;
    status.textContent = "记录完成。可以切换模式继续，或复制结果。";
  }

  renderer.render = (scene, camera) => {
    const sample = recording;
    if (!sample) return render(scene, camera);
    const started = performance.now();
    const motion = getMotion();
    if (motion) sample.lastMotionAt = started;
    const phase = motion ?? (started - sample.lastMotionAt < 550 ? "停手后" : null);
    const interval = started - sample.previousAt;
    sample.previousAt = started;
    const [overview, detail] = sample.mode === "base" ? getTileLayers() : [];
    const overviewVisible = overview?.visible ?? false;
    const detailVisible = detail?.visible ?? false;
    if (overview) overview.visible = false;
    if (detail) detail.visible = false;
    const query = gpu?.begin(phase ? sample.gpu[phase] : undefined);
    const renderStarted = performance.now();
    let submit = 0;
    try {
      render(scene, camera);
      submit = performance.now() - renderStarted;
    } finally {
      if (query) gpu?.end();
      if (overview) overview.visible = overviewVisible;
      if (detail) detail.visible = detailVisible;
    }
    if (phase && interval > 0 && Number.isFinite(interval)) {
      sample.frames[phase].push({ started, interval, submit, calls: renderer.info.render.calls });
    }
  };

  recordButton.addEventListener("click", () => {
    const mode = select.value as Mode;
    const ratio = renderer.getPixelRatio();
    if (mode === "pixels") renderer.setPixelRatio(ratio * Math.SQRT1_2);
    recording = { mode, ratio, previousAt: Infinity, lastMotionAt: -Infinity,
      frames: { "拖动": [], "滚轮": [], "停手后": [] },
      gpu: { "拖动": [], "滚轮": [], "停手后": [] },
      tiles: { "瓦片视野更新": [], "纹理上传": [] },
      longFrames: [],
      timer: setTimeout(() => finish(), 8000) };
    observer?.observe({ type: "long-animation-frame" });
    select.disabled = recordButton.disabled = true;
    status.textContent = "正在记录。现在拖动地球并用滚轮缩放。";
  });
  document.addEventListener("visibilitychange", () => { if (document.hidden) finish(true); });
  copy.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(result.textContent ?? "");
      status.textContent = "测试结果已复制。";
    } catch {
      status.textContent = "可以选中上面的结果并手动复制。";
    }
  });
  return (name: TileWork, startTime: number) => {
    recording?.tiles[name].push({ startTime, duration: performance.now() - startTime });
  };
}
