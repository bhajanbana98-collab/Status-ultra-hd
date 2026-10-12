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
    <div class="eyebrow">VIDEO WORKFLOW</div>
    <h2>Make every status<br><span>look sharper.</span></h2>
    <p>Cut clips and export MP4 for WhatsApp Status.</p>
  </section>

  <section class="card">
    <h3>01 · Choose video</h3>
    <input id="file" type="file" accept="video/*">
    <p id="fileInfo">Select a video to begin.</p>
  </section>

  <section class="card">
    <h3>02 · Export settings</h3>

    <label>Clip duration</label>
    <select id="duration">
      <option value="15">15 seconds</option>
      <option value="30" selected>30 seconds</option>
      <option value="60">60 seconds</option>
      <option value="all">Full video</option>
    </select>

    <label>Resolution</label>
    <select id="resolution">
      <option value="1080">1080p Full HD</option>
      <option value="720">720p HD</option>
    </select>

    <label>Quality</label>
    <select id="quality">
      <option value="high">High quality</option>
      <option value="balanced" selected>Balanced</option>
      <option value="small">Smaller file</option>
    </select>

    <label class="check"><input id="portrait" type="checkbox" checked> Fit 9:16 portrait</label>
    <label class="check"><input id="audio" type="checkbox" checked> Keep audio</label>

    <button id="engine">Check FFmpeg engine</button>
    <button id="start" disabled>⚡ Compress and split</button>

    <progress id="progress" value="0" max="100"></progress>
    <p id="status">Engine not loaded.</p>
    <div id="results"></div>
  </section>
</div>`;

let ffmpeg;
let selectedFile;

const $ = id => document.getElementById(id);

$('file').addEventListener('change', event => {
  selectedFile = event.target.files[0];
  if (!selectedFile) return;

  $('fileInfo').textContent =
    `${selectedFile.name} · ${(selectedFile.size / 1048576).toFixed(2)} MB`;

  $('start').disabled = false;
});

async function loadEngine() {
  if (ffmpeg?.loaded) return ffmpeg;

  ffmpeg = new FFmpeg();

  ffmpeg.on('progress', event => {
    $('progress').value = Math.round((event.progress || 0) * 100);
  });

  $('status').textContent = 'Loading FFmpeg core…';

  const base =
    'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/umd';

  const coreURL = await toBlobURL(
    `${base}/ffmpeg-core.js`,
    'text/javascript'
  );

  const wasmURL = await toBlobURL(
    `${base}/ffmpeg-core.wasm`,
    'application/wasm'
  );

  await ffmpeg.load({ coreURL, wasmURL });

  $('status').textContent = 'FFmpeg engine loaded.';
  return ffmpeg;
}

$('engine').addEventListener('click', async () => {
  try {
    await loadEngine();
  } catch (error) {
    $('status').textContent = 'Engine error: ' + error.message;
  }
});

$('start').addEventListener('click', async () => {
  if (!selectedFile) return;

  $('start').disabled = true;

  try {
    const engine = await loadEngine();

    const extension =
      (selectedFile.name.match(/\.[a-z0-9]+$/i) || ['.mp4'])[0];

    const inputName = 'input' + extension;
    await engine.writeFile(
      inputName,
      new Uint8Array(await selectedFile.arrayBuffer())
    );

    const duration = await new Promise((resolve, reject) => {
      const video = document.createElement('video');
      const url = URL.createObjectURL(selectedFile);

      video.onloadedmetadata = () => {
        URL.revokeObjectURL(url);
        resolve(video.duration);
      };

      video.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Cannot read video duration.'));
      };

      video.src = url;
    });

    const chosen = $('duration').value;
    const segment = chosen === 'all' ? duration : Number(chosen);
    const height = Number($('resolution').value);
    const portrait = $('portrait').checked;
    const quality = $('quality').value;

    const bitrate =
      quality === 'high' ? '8M' :
      quality === 'small' ? '2.5M' : '5M';

    const filter = portrait
      ? `scale=${Math.round(height * 9 / 16)}:${height}:force_original_aspect_ratio=decrease,pad=${Math.round(height * 9 / 16)}:${height}:(ow-iw)/2:(oh-ih)/2,setsar=1`
      : `scale=-2:${height}`;

    $('results').innerHTML = '';

    let part = 0;

    for (let start = 0; start < duration; start += segment) {
      part++;

      const output = `status_${part}.mp4`;
      const clipDuration = Math.min(segment, duration - start);

      $('status').textContent =
        `Processing clip ${part}…`;

      const args = [
        '-ss', String(start),
        '-i', inputName,
        '-t', String(clipDuration),
        '-vf', filter,
        '-c:v', 'libx264',
        '-preset', 'ultrafast',
        '-b:v', bitrate,
        '-pix_fmt', 'yuv420p'
      ];

      if ($('audio').checked) {
        args.push('-c:a', 'aac', '-b:a', '128k');
      } else {
        args.push('-an');
      }

      args.push('-movflags', '+faststart', '-y', output);

      await engine.exec(args);

      const data = await engine.readFile(output);
      const blob = new Blob([data], { type: 'video/mp4' });
      const url = URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.href = url;
      link.download = output;
      link.textContent = `Download clip ${part}`;
      link.className = 'download';

      $('results').appendChild(link);
      $('results').appendChild(document.createElement('br'));

      await engine.deleteFile(output);
    }

    await engine.deleteFile(inputName);
    $('status').textContent = 'All clips exported.';
    $('progress').value = 100;

  } catch (error) {
    $('status').textContent = 'Error: ' + error.message;
  } finally {
    $('start').disabled = false;
  }
});
