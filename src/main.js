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
      <small>MP4, MOV, WEBM and other supported formats</small>
    </label>
    <input id="file" type="file" accept="video/*">
    <p id="fileInfo">No video selected.</p>
  </section>

  <section class="card">
    <h3>02 · Export settings</
