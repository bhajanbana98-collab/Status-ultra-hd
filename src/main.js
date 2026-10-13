import { FFmpeg } from '@ffmpeg/ffmpeg';
import { toBlobURL } from '@ffmpeg/util';
import './style.css';

const app = document.getElementById('app');

app.innerHTML = `
<div class="wrap">
  <header class="top">
    <div class="brand">
      <div class="logo">▶</div>
      <div>
        <h1>STATUS <span>ULTRA HD</span></h1>
        <p>FFmpeg Video Studio</p>
      </div>
    </div>
    <div class="badge">● FFMPEG ENGINE</div>
  </header>

  <section class="hero">
    <div class="eyebrow">PREMIUM VIDEO WORKFLOW</div>
    <h2>Make every status<br><span>look sharper.</span></h2>
    <p>Compress, split and export MP4 videos for WhatsApp Status.</p>
  </section>

  <section class="card">
    <h3>01 · Choose video</h3>
    <label class="drop" for="file">
      <span style="font-size:32px">📹</span>
      <strong>Tap to select a video</strong>
      <small>Choose a video supported by your browser.</small>
    </label>
    <input id="file" type="file" accept="video/*">
    <p id="fileInfo">No video selected.</p>
  </section>

  <section class="card">
    <h3>02 · Export settings</h3>

    <label for="duration">Clip duration</label>
    <select id="duration">
      <option value="15">15 seconds</option>
      <option value="30" selected>30 seconds</option>
      <option value="60">60 seconds</option>
      <option value="all">Full video</option>
    </select>

    <label for="resolution">Resolution</label>
    <select id="resolution">
      <option value="1080">1080p Full HD</option>
      <option value="720">720p HD</option>
    </select>

    <label for="quality">Quality</label>
    <select id="quality">
      <option value="high">High quality</option>
      <option value="balanced" selected>Balanced</option>
      <option value="small">Smaller file</option>
    </select>

    <label class="check">
      <input id="portrait" type="checkbox" checked>
      Fit 9:16 portrait
    </label>

    <label class="check">
      <input id="audio" type="checkbox" checked>
      Keep audio
    </label>

    <button id="engine">Load FFmpeg engine</button>
    <button id="start" disabled>⚡ Compress and split</button>

    <progress id="progress" value="0" max="100"></progress>
    <p id="status">FFmpeg engine not loaded.</p>
    <div id="results"></div>
  </section>

  <footer>STATUS ULTRA HD · Your video is processed in this browser.</footer>
</div>
`;

const $ = id => document.getElementById(id);

let ffmpeg = null;
let selectedFile = null;
let engineLoading = null;

$('file').addEventListener('change', event => {
  selectedFile = event.target.files?.[0] || null;

  $('fileInfo').textContent = selectedFile
    ? `${selectedFile.name} · ${(selectedFile.size / 1048576).toFixed(2)} MB`
    : 'No video selected.';

  $('start').disabled = !selectedFile;
});

async function loadEngine() {
  if (ffmpeg?.loaded) return ffmpeg;
  if (engineLoading) return engineLoading;

  engineLoading = (async () => {
    const instance = new FFmpeg();

    instance.on('progress', event => {
      const value = Math.round((event.progress || 0) * 100);
      $('progress').value = Math.max(0, Math.min(100, value));
    });

    $('status').textContent = 'Downloading FFmpeg engine…';

    const base =
      'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/umd';

    const coreURL = await toBlobURL(
      `${base}/ffmpeg-core.js`,
      'text/javascript'
    );

    const wasmURL = await toBlobURL(
      `${base}/ffmpeg-core.wasm`,
      'application/wasm'
    );

    await instance.load({ coreURL, wasmURL });

    ffmpeg = instance;
    $('status').textContent = 'FFmpeg engine loaded successfully.';
    return instance;
  })();

  try {
    return await engineLoading;
  } catch (error) {
    $('status').textContent =
      'Engine error: ' + (error?.message || String(error));
    throw error;
  } finally {
    engineLoading = null;
  }
}

$('engine').addEventListener('click', async () => {
  $('engine').disabled = true;

  try {
    await loadEngine();
  } catch (error) {
    console.error(error);
  } finally {
    $('engine').disabled = false;
  }
});

function getVideoDuration(file) {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    const url = URL.createObjectURL(file);

    video.preload = 'metadata';

    video.onloadedmetadata = () => {
      const duration = video.duration;
      URL.revokeObjectURL(url);

      if (!Number.isFinite(duration) || duration <= 0) {
        reject(new Error('Could not determine video duration.'));
      } else {
        resolve(duration);
      }
    };

    video.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Browser could not read this video.'));
    };

    video.src = url;
  });
}

$('start').addEventListener('click', async () => {
  if (!selectedFile) {
    $('status').textContent = 'Please select a video first.';
    return;
  }

  const file = selectedFile;
  $('start').disabled = true;
  $('engine').disabled = true;
  $('progress').value = 0;
  $('results').replaceChildren();

  let inputName = null;
  let engine = null;

  try {
    engine = await loadEngine();

    $('status').textContent = 'Reading video…';

    const duration = await getVideoDuration(file);
    const selectedDuration = $('duration').value;
    const segmentDuration =
      selectedDuration === 'all' ? duration : Number(selectedDuration);

    const height = Number($('resolution').value);
    const quality = $('quality').value;

    const videoBitrate =
      quality === 'high' ? '8M' :
      quality === 'small' ? '2.5M' : '5M';

    const filter = $('portrait').checked
      ? `scale=${Math.round(height * 9 / 16)}:${height}:force_original_aspect_ratio=decrease,pad=${Math.round(height * 9 / 16)}:${height}:(ow-iw)/2:(oh-ih)/2,setsar=1`
      : `scale=-2:${height},setsar=1`;

    const extension =
      (file.name.match(/\.([a-z0-9]+)$/i)?.[1] || 'mp4').toLowerCase();

    inputName = `input.${extension}`;

    $('status').textContent = 'Preparing video for conversion…';

    await engine.writeFile(
      inputName,
      new Uint8Array(await file.arrayBuffer())
    );

    const totalParts = Math.ceil(duration / segmentDuration);

    for (let part = 0; part < totalParts; part++) {
      const start = part * segmentDuration;
      const clipDuration = Math.min(segmentDuration, duration - start);
      const outputName = `status_${part + 1}.mp4`;

      $('status').textContent =
        `Exporting clip ${part + 1} of ${totalParts}…`;

      const args = [
        '-ss', String(start),
        '-i', inputName,
        '-t', String(clipDuration),
        '-vf', filter,
        '-c:v', 'libx264',
        '-preset', 'ultrafast',
        '-b:v', videoBitrate,
        '-pix_fmt', 'yuv420p'
      ];

      if ($('audio').checked) {
        args.push('-c:a', 'aac', '-b:a', '128k');
      } else {
        args.push('-an');
      }

      args.push(
        '-movflags', '+faststart',
        '-y',
        outputName
      );

      const exitCode = await engine.exec(args);

      if (exitCode !== 0) {
        throw new Error(
          `FFmpeg could not export clip ${part + 1}.`
        );
      }

      const data = await engine.readFile(outputName);
      const blob = new Blob([data], { type: 'video/mp4' });
      const url = URL.createObjectURL(blob);

      const item = document.createElement('div');
      item.className = 'result-item';

      const title = document.createElement('p');
      title.textContent =
        `Clip ${part + 1} · ${(blob.size / 1048576).toFixed(2)} MB`;

      const download = document.createElement('a');
      download.className = 'download';
      download.href = url;
      download.download = outputName;
      download.textContent = 'Download MP4';

      item.append(title, download);

      if (navigator.can
