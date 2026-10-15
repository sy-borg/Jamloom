const form = document.querySelector('#upload-form');
const fileInput = document.querySelector('#audio-file');
const fileLabel = document.querySelector('#file-label');
const dropZone = document.querySelector('#drop-zone');
const modelSelect = document.querySelector('#model');
const submitButton = document.querySelector('#submit-button');
const resultPanel = document.querySelector('#result-panel');
const jobMessage = document.querySelector('#job-message');
const progressBar = document.querySelector('#progress-bar');
const errorBox = document.querySelector('#error-box');
const playerArea = document.querySelector('#player-area');
const audioPlayer = document.querySelector('#audio-player');
const downloadLink = document.querySelector('#download-link');
const stemsToggle = document.querySelector('#stems-toggle');
const stemsList = document.querySelector('#stems-list');
const mixerModelLabel = document.querySelector('#mixer-model-label');
const masterVolume = document.querySelector('#master-volume');
const masterVolumeValue = document.querySelector('#master-volume-value');
const rewindButton = document.querySelector('#rewind-button');
const playToggleButton = document.querySelector('#play-toggle-button');
const forwardButton = document.querySelector('#forward-button');
const timeDisplay = document.querySelector('#time-display');
const setLoopStartButton = document.querySelector('#set-loop-start');
const setLoopEndButton = document.querySelector('#set-loop-end');
const loopToggleButton = document.querySelector('#loop-toggle');
const clearLoopButton = document.querySelector('#clear-loop');
const loopStartDisplay = document.querySelector('#loop-start-display');
const loopEndDisplay = document.querySelector('#loop-end-display');
const loopMessage = document.querySelector('#loop-message');
const speedSelect = document.querySelector('#speed-select');
const sourceBpmInput = document.querySelector('#source-bpm');
const targetBpmInput = document.querySelector('#target-bpm');
const applyBpmButton = document.querySelector('#apply-bpm');
const tempoMessage = document.querySelector('#tempo-message');
let metronomeBpmInput = null;
let metronomeLevelInput = null;
let metronomeLevelValue = null;
let metronomeMuteButton = null;
let metronomeSoloButton = null;
const metronomeEffectiveBpm = document.querySelector('#metronome-effective-bpm');
const metronomeMessage = document.querySelector('#metronome-message');
const libraryList = document.querySelector('#library-list');
const libraryStatus = document.querySelector('#library-status');
const librarySearch = document.querySelector('#library-search');
const librarySort = document.querySelector('#library-sort');
const separatorPanel = document.querySelector('#separator-panel');
const showSeparatorButton = document.querySelector('#show-separator');
const hideSeparatorButton = document.querySelector('#hide-separator');
const mixerEmptyState = document.querySelector('#mixer-empty-state');
const jobProgress = document.querySelector('#job-progress');
let libraryTracks = [];
let loopStart = null;
let loopEnd = null;
let loopEnabled = false;
let pollTimer = null;
let currentStems = {};
let currentJobId = null;
let mixerMode = false;
let soloedStem = null;
const stemPlayers = new Map();
let metronomeMuted = false;
let audioContext = null;
let metronomeTimer = null;
let nextBeatTime = null;
let lastMetronomeMediaTime = null;

function settingsKey(trackId) { return `jamloom.settings.${trackId}`; }
function saveTrackSettings() {
  if (!currentJobId) return;
  const stems = {};
  for (const [name, player] of stemPlayers) stems[name] = {level: Number(player.slider.value), muted: player.userMuted};
  const settings = {
    masterVolume: Number(masterVolume.value), speed: audioPlayer.playbackRate || 1,
    loopStart, loopEnd, loopEnabled, stems,
    metronomeBpm: Number(metronomeBpmInput?.value || 120),
    metronomeLevel: Number(metronomeLevelInput?.value || 60), metronomeMuted,
  };
  try { localStorage.setItem(settingsKey(currentJobId), JSON.stringify(settings)); } catch {}
}
function restoreTrackSettings(trackId) {
  let settings;
  try { settings = JSON.parse(localStorage.getItem(settingsKey(trackId)) || 'null'); } catch { settings = null; }
  if (!settings) return;
  if (Number.isFinite(settings.masterVolume)) { masterVolume.value = String(Math.max(0, Math.min(100, settings.masterVolume))); masterVolumeValue.textContent = `${masterVolume.value}%`; }
  if (Number.isFinite(settings.speed) && settings.speed >= 0.25 && settings.speed <= 2) setPlaybackSpeed(settings.speed, true);
  loopStart = Number.isFinite(settings.loopStart) ? settings.loopStart : null;
  loopEnd = Number.isFinite(settings.loopEnd) ? settings.loopEnd : null;
  loopEnabled = Boolean(settings.loopEnabled && loopStart !== null && loopEnd !== null && loopEnd > loopStart);
  if (settings.stems) for (const [name, state] of Object.entries(settings.stems)) {
    const player = stemPlayers.get(name); if (!player) continue;
    if (Number.isFinite(state.level)) player.slider.value = String(Math.max(0, Math.min(100, state.level)));
    player.value.textContent = `${player.slider.value}%`; player.userMuted = Boolean(state.muted);
  }
  if (metronomeBpmInput && Number.isFinite(settings.metronomeBpm)) metronomeBpmInput.value = String(Math.max(30, Math.min(300, settings.metronomeBpm)));
  if (metronomeLevelInput && Number.isFinite(settings.metronomeLevel)) { metronomeLevelInput.value = String(Math.max(0, Math.min(100, settings.metronomeLevel))); metronomeLevelValue.textContent = `${metronomeLevelInput.value}%`; }
  metronomeMuted = Boolean(settings.metronomeMuted);
  updateLoopUI(); updateStemAudioLevels(); resetMetronomeGrid(); saveTrackSettings();
}
function formatLibraryDuration(seconds) {
  if (!Number.isFinite(Number(seconds))) return 'Duration unknown';
  const total = Math.max(0, Math.floor(Number(seconds)));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}
function renderLibrary() {
  const query = librarySearch.value.trim().toLocaleLowerCase();
  const sort = librarySort.value;
  const tracks = libraryTracks.filter(track => [track.title, track.artist, track.album, track.filename].some(value => String(value || '').toLocaleLowerCase().includes(query)));
  tracks.sort((a, b) => {
    if (sort === 'title') return String(a.title || a.filename || '').localeCompare(String(b.title || b.filename || ''), undefined, {sensitivity:'base'});
    if (sort === 'artist') return String(a.artist || '').localeCompare(String(b.artist || ''), undefined, {sensitivity:'base'}) || String(a.title || a.filename || '').localeCompare(String(b.title || b.filename || ''), undefined, {sensitivity:'base'});
    if (sort === 'album') return String(a.album || '').localeCompare(String(b.album || ''), undefined, {sensitivity:'base'}) || String(a.title || a.filename || '').localeCompare(String(b.title || b.filename || ''), undefined, {sensitivity:'base'});
    if (sort === 'duration') return Number(b.duration || 0) - Number(a.duration || 0);
    return String(b.created_at || '').localeCompare(String(a.created_at || ''));
  });
  libraryList.replaceChildren();
  if (!libraryTracks.length) { libraryStatus.textContent = 'Your library is empty. Create a backing track to get started.'; return; }
  libraryStatus.textContent = `${tracks.length} of ${libraryTracks.length} song${libraryTracks.length === 1 ? '' : 's'} shown · available to everyone using this Jamloom instance.`;
  if (!tracks.length) { const empty = document.createElement('p'); empty.className = 'library-no-results'; empty.textContent = 'No songs match that search.'; libraryList.append(empty); return; }
  for (const track of tracks) {
    const row = document.createElement('article'); row.className = 'library-item';
    const details = document.createElement('div'); details.className = 'library-item-details';
    const title = document.createElement('strong'); title.textContent = track.title || (track.filename || 'Untitled track').replace(/\.[^.]+$/, '');
    const artist = document.createElement('span'); artist.className = 'library-artist'; artist.textContent = [track.artist, track.album].filter(Boolean).join(' · ') || 'Artist and album not set';
    const meta = document.createElement('span');
    const date = track.created_at ? new Date(track.created_at).toLocaleDateString() : 'Saved';
    const model = track.model === 'htdemucs_6s' ? '6 stems' : '4 stems';
    const musicInfo = [track.bpm ? `${Number(track.bpm)} BPM` : '', track.time_signature || ''].filter(Boolean).join(' · ');
    meta.textContent = [formatLibraryDuration(track.duration), model, musicInfo, date].filter(Boolean).join(' · ');
    details.append(title, artist, meta);
    const actions = document.createElement('div'); actions.className = 'library-item-actions';
    const open = document.createElement('button'); open.type = 'button'; open.className = 'button secondary'; open.textContent = 'Open mixer';
    open.addEventListener('click', () => loadLibraryTrack(track.id));
    const edit = document.createElement('button'); edit.type = 'button'; edit.className = 'button ghost'; edit.textContent = 'Edit details';
    edit.addEventListener('click', async () => {
      const nextTitle = window.prompt('Track title:', track.title || (track.filename || '').replace(/\.[^.]+$/, '')); if (nextTitle === null) return;
      const nextArtist = window.prompt('Artist:', track.artist || ''); if (nextArtist === null) return;
      const nextAlbum = window.prompt('Album:', track.album || ''); if (nextAlbum === null) return;
      const nextBpmText = window.prompt('Track BPM (leave empty if unknown):', track.bpm == null ? '' : String(track.bpm)); if (nextBpmText === null) return;
      const nextBpm = nextBpmText.trim() === '' ? null : Number(nextBpmText);
      if (nextBpm !== null && (!Number.isFinite(nextBpm) || nextBpm < 1 || nextBpm > 400)) { libraryStatus.textContent = 'BPM must be a number between 1 and 400, or left empty.'; return; }
      const nextSignature = window.prompt('Time signature (e.g. 4/4, 3/4, 6/8; leave empty if unknown):', track.time_signature || ''); if (nextSignature === null) return;
      if (nextSignature.trim() && !/^(?:[1-9]|1[0-6])\s*\/\s*(?:1|2|4|8|16)$/.test(nextSignature.trim())) { libraryStatus.textContent = 'Use a time signature such as 4/4, 3/4 or 6/8 (numerator 1–16; denominator 1, 2, 4, 8 or 16).'; return; }
      edit.disabled = true;
      try {
        const res = await fetch(`/api/library/${encodeURIComponent(track.id)}`, {method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify({title:nextTitle, artist:nextArtist, album:nextAlbum, bpm:nextBpm, time_signature:nextSignature.trim()})});
        const result = await res.json(); if (!res.ok) throw new Error(result.detail || 'Could not update track details.');
        await loadLibrary();
        if (currentJobId === track.id) document.querySelector('#result-filename').textContent = result.track.title || result.track.filename || 'Backing track';
      } catch (err) { libraryStatus.textContent = err.message; edit.disabled = false; }
    });
    const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'button ghost library-delete'; remove.textContent = 'Delete';
    remove.addEventListener('click', async () => {
      if (!window.confirm(`Delete “${track.title || track.filename || 'this track'}” and its separated audio from the shared library? This cannot be undone.`)) return;
      remove.disabled = true;
      try { const res = await fetch(`/api/library/${encodeURIComponent(track.id)}`, {method:'DELETE'}); const result = await res.json(); if (!res.ok) throw new Error(result.detail || 'Delete failed.');
        if (currentJobId === track.id) { audioPlayer.pause(); stopMetronome(); stopStemPlayers(); playerArea.hidden = true; mixerEmptyState.hidden = false; currentJobId = null; }
        try { localStorage.removeItem(settingsKey(track.id)); } catch {}
        await loadLibrary();
      } catch (err) { libraryStatus.textContent = err.message; remove.disabled = false; }
    });
    actions.append(open, edit, remove); row.append(details, actions); libraryList.append(row);
  }
}
async function loadLibrary() {
  try {
    const response = await fetch('/api/library'); const data = await response.json();
    if (!response.ok) throw new Error(data.detail || 'Could not load library.');
    libraryTracks = data.tracks || [];
    renderLibrary();
  } catch (err) { libraryStatus.textContent = `Library could not be loaded: ${err.message}`; }
}
librarySearch.addEventListener('input', renderLibrary);
librarySort.addEventListener('change', renderLibrary);
showSeparatorButton.addEventListener('click', () => { separatorPanel.hidden = false; separatorPanel.scrollIntoView({behavior:'smooth', block:'start'}); });
hideSeparatorButton.addEventListener('click', () => { if (pollTimer || submitButton.disabled) return; separatorPanel.hidden = true; errorBox.hidden = true; });

async function loadLibraryTrack(trackId) {
  try {
    const response = await fetch('/api/library'); const data = await response.json();
    if (!response.ok) throw new Error(data.detail || 'Could not read library.');
    const track = data.tracks.find(item => item.id === trackId);
    if (!track) throw new Error('This track is no longer in the library.');
    errorBox.hidden = true;
    loadCompletedTrack(track, true);
    resultPanel.scrollIntoView({behavior:'smooth', block:'start'});
  } catch (err) { libraryStatus.textContent = err.message; }
}

modelSelect.addEventListener('change', () => {
  mixerModelLabel.textContent = modelSelect.value === 'htdemucs_6s' ? '6 stems · vocals, drums, bass, guitar, piano, other' : '4 stems · vocals, drums, bass, other';
});
mixerModelLabel.textContent = modelSelect.value === 'htdemucs_6s' ? '6 stems · vocals, drums, bass, guitar, piano, other' : '4 stems · vocals, drums, bass, other';
fileInput.addEventListener('change', () => { fileLabel.textContent = fileInput.files[0]?.name || 'Drop an audio file here'; });
for (const eventName of ['dragenter','dragover']) dropZone.addEventListener(eventName, e => { e.preventDefault(); dropZone.classList.add('dragging'); });
for (const eventName of ['dragleave','drop']) dropZone.addEventListener(eventName, e => { e.preventDefault(); dropZone.classList.remove('dragging'); });
dropZone.addEventListener('drop', e => { if (e.dataTransfer.files.length) { fileInput.files = e.dataTransfer.files; fileLabel.textContent = fileInput.files[0].name; } });

function showError(message) { errorBox.hidden = false; errorBox.textContent = message; }
function setProgress(status) {
  const widths = {queued: '8%', processing: '65%', completed: '100%', failed: '100%'};
  progressBar.style.width = widths[status] || '15%';
}
function stopStemPlayers() {
  for (const player of stemPlayers.values()) {
    player.audio.pause();
    player.audio.removeAttribute('src');
    player.audio.load();
  }
  stemPlayers.clear();
}
function syncStemPlayers(force = false) {
  if (!mixerMode) return;
  const masterTime = audioPlayer.currentTime || 0;
  for (const player of stemPlayers.values()) {
    if (Number.isFinite(player.audio.duration) && masterTime >= player.audio.duration) continue;
    if (force || Math.abs((player.audio.currentTime || 0) - masterTime) > 0.3) {
      try { player.audio.currentTime = masterTime; } catch {}
    }
    player.audio.playbackRate = audioPlayer.playbackRate;
    setPitchPreservation(player.audio);
  }
}
async function playStemPlayers() {
  if (!mixerMode) return;
  syncStemPlayers(true);
  const results = await Promise.allSettled([...stemPlayers.values()].map(({audio}) => audio.play()));
  const failed = results.find(result => result.status === 'rejected');
  if (failed) tempoMessage.textContent = `Some stems could not start: ${failed.reason?.message || 'browser playback error'}`;
}
function setPitchPreservation(media) {
  // Native browser time-stretching keeps pitch stable while playbackRate changes.
  if ('preservesPitch' in media) media.preservesPitch = true;
  if ('webkitPreservesPitch' in media) media.webkitPreservesPitch = true;
  if ('mozPreservesPitch' in media) media.mozPreservesPitch = true;
}
setPitchPreservation(audioPlayer);

function masterGain() {
  return Number(masterVolume.value) / 100;
}
function updateStemAudioLevels() {
  for (const [name, player] of stemPlayers) {
    player.audio.volume = masterGain() * (Number(player.slider.value) / 100);
    const isSoloMuted = soloedStem !== null && soloedStem !== name;
    player.audio.muted = player.userMuted || isSoloMuted;
    player.mute.textContent = player.userMuted ? 'Unmute' : 'Mute';
    player.mute.setAttribute('aria-pressed', String(player.userMuted));
    player.solo.textContent = soloedStem === name ? 'Unsolo' : 'Solo';
    player.solo.setAttribute('aria-pressed', String(soloedStem === name));
    player.row.classList.toggle('stem-muted', player.audio.muted);
    player.row.classList.toggle('stem-soloed', soloedStem === name);
  }
  const metroSoloMuted = soloedStem !== null && soloedStem !== '__metronome';
  const metroMuted = metronomeMuted || metroSoloMuted;
  if (metronomeMuteButton) {
    metronomeMuteButton.textContent = metronomeMuted ? 'Unmute' : 'Mute';
    metronomeMuteButton.setAttribute('aria-pressed', String(metronomeMuted));
  }
  if (metronomeSoloButton) {
    metronomeSoloButton.textContent = soloedStem === '__metronome' ? 'Unsolo' : 'Solo';
    metronomeSoloButton.setAttribute('aria-pressed', String(soloedStem === '__metronome'));
  }
  document.querySelector('#metronome-row')?.classList.toggle('stem-muted', metroMuted);
  document.querySelector('#metronome-row')?.classList.toggle('stem-soloed', soloedStem === '__metronome');
  updateMetronomeBpmDisplay();
}
function setMixerMode(enabled) {
  mixerMode = enabled;
  audioPlayer.muted = enabled;
  audioPlayer.volume = masterGain();
  stemsToggle.textContent = enabled ? 'Use backing mix' : 'Use stem mixer';
  stemsList.classList.toggle('mixer-active', enabled);
  if (enabled) {
    updateStemAudioLevels();
    syncStemPlayers(true);
    if (!audioPlayer.paused) playStemPlayers();
    tempoMessage.textContent = 'Stem mixer active. Tempo changes preserve pitch in supported browsers.';
  } else {
    for (const player of stemPlayers.values()) player.audio.pause();
    audioPlayer.muted = false;
    audioPlayer.volume = masterGain();
    tempoMessage.textContent = 'Backing mix active. Tempo changes preserve pitch in supported browsers.';
  }
}
function renderStems(stems) {
  stopStemPlayers();
  soloedStem = null;
  stemsList.replaceChildren();
  const intro = document.createElement('p');
  intro.className = 'mixer-intro';
  intro.textContent = 'Adjust each instrument independently. Solo temporarily isolates one stem; mute choices and levels are preserved when switching playback modes.';
  stemsList.append(intro);
  for (const [name, url] of Object.entries(stems || {})) {
    const row = document.createElement('div'); row.className = 'stem-row';
    const info = document.createElement('div'); info.className = 'stem-info';
    const label = document.createElement('strong'); label.textContent = name[0].toUpperCase() + name.slice(1);
    const value = document.createElement('span'); value.className = 'stem-level-value'; value.textContent = '100%';
    info.append(label, value);
    const audio = document.createElement('audio'); audio.preload = 'auto'; audio.src = url; audio.loop = false;
    audio.playbackRate = audioPlayer.playbackRate;
    setPitchPreservation(audio);
    audio.addEventListener('loadedmetadata', () => { try { audio.currentTime = audioPlayer.currentTime || 0; } catch {} });
    const sliderLabel = document.createElement('label'); sliderLabel.className = 'stem-volume-label';
    sliderLabel.append(document.createTextNode('Level'));
    const slider = document.createElement('input'); slider.type = 'range'; slider.min = '0'; slider.max = '100'; slider.step = '1'; slider.value = '100'; slider.setAttribute('aria-label', `${name} volume`);
    slider.addEventListener('input', () => {
      value.textContent = `${slider.value}%`;
      updateStemAudioLevels(); saveTrackSettings();
    });
    const mute = document.createElement('button'); mute.type = 'button'; mute.className = 'button ghost stem-mute'; mute.textContent = 'Mute'; mute.setAttribute('aria-pressed', 'false');
    mute.addEventListener('click', () => {
      const player = stemPlayers.get(name);
      player.userMuted = !player.userMuted;
      updateStemAudioLevels(); saveTrackSettings();
    });
    const solo = document.createElement('button'); solo.type = 'button'; solo.className = 'button ghost stem-solo'; solo.textContent = 'Solo'; solo.setAttribute('aria-pressed', 'false');
    solo.addEventListener('click', () => {
      soloedStem = soloedStem === name ? null : name;
      updateStemAudioLevels(); saveTrackSettings();
    });
    const download = document.createElement('a'); download.className = 'stem-download'; download.href = url; download.download = `${name}.wav`; download.textContent = '↓ WAV';
    const controls = document.createElement('div'); controls.className = 'stem-controls';
    sliderLabel.append(slider); controls.append(sliderLabel, mute, solo, download);
    row.append(info, controls, audio); stemsList.append(row);
    stemPlayers.set(name, {audio, slider, value, mute, solo, row, userMuted: false});
  }
  renderMetronomeRow();
  stemsList.hidden = false;
  updateStemAudioLevels();
  setMixerMode(true);
}
masterVolume.addEventListener('input', () => {
  masterVolumeValue.textContent = `${masterVolume.value}%`;
  audioPlayer.volume = masterGain();
  updateStemAudioLevels(); saveTrackSettings();
});
masterVolumeValue.textContent = `${masterVolume.value}%`;
function renderMetronomeRow() {
  document.querySelector('#metronome-row')?.remove();
  const row = document.createElement('div');
  row.id = 'metronome-row';
  row.className = 'stem-row metronome-row';
  const info = document.createElement('div');
  info.className = 'stem-info';
  const title = document.createElement('strong');
  title.textContent = 'Metronome';
  const levelValue = document.createElement('span');
  levelValue.className = 'stem-level-value';
  levelValue.id = 'metronome-level-value';
  levelValue.textContent = '60%';
  info.append(title, levelValue);

  const controls = document.createElement('div');
  controls.className = 'stem-controls metronome-controls';
  const bpmLabel = document.createElement('label');
  bpmLabel.className = 'metronome-bpm-label';
  bpmLabel.textContent = 'BPM';
  const bpmInput = document.createElement('input');
  bpmInput.id = 'metronome-bpm';
  bpmInput.type = 'number';
  bpmInput.min = '30';
  bpmInput.max = '300';
  bpmInput.step = '1';
  bpmInput.value = '120';
  bpmInput.setAttribute('aria-label', 'Metronome tempo in beats per minute at normal playback speed');
  bpmLabel.append(bpmInput);

  const volumeLabel = document.createElement('label');
  volumeLabel.className = 'stem-volume-label';
  volumeLabel.append(document.createTextNode('Level'));
  const volume = document.createElement('input');
  volume.id = 'metronome-level';
  volume.type = 'range';
  volume.min = '0'; volume.max = '100'; volume.step = '1'; volume.value = '60';
  volume.setAttribute('aria-label', 'Metronome volume');
  volumeLabel.append(volume);

  const mute = document.createElement('button');
  mute.id = 'metronome-mute'; mute.type = 'button'; mute.className = 'button ghost stem-mute'; mute.textContent = 'Mute'; mute.setAttribute('aria-pressed', 'false');
  const solo = document.createElement('button');
  solo.id = 'metronome-solo'; solo.type = 'button'; solo.className = 'button ghost stem-solo'; solo.textContent = 'Solo'; solo.setAttribute('aria-pressed', 'false');
  controls.append(bpmLabel, volumeLabel, mute, solo);
  row.append(info, controls);
  stemsList.append(row);
  metronomeBpmInput = bpmInput;
  metronomeLevelInput = volume;
  metronomeLevelValue = levelValue;
  metronomeMuteButton = mute;
  metronomeSoloButton = solo;

  bpmInput.addEventListener('change', () => {
    const bpm = Number(bpmInput.value);
    if (!Number.isFinite(bpm) || bpm < 30 || bpm > 300) {
      bpmInput.setCustomValidity('Enter a BPM between 30 and 300.');
      bpmInput.reportValidity();
      bpmInput.value = '120';
    }
    bpmInput.setCustomValidity('');
    resetMetronomeGrid();
    updateMetronomeBpmDisplay(); saveTrackSettings();
  });
  volume.addEventListener('input', () => {
    levelValue.textContent = `${volume.value}%`;
    updateStemAudioLevels(); saveTrackSettings();
  });
  mute.addEventListener('click', () => { metronomeMuted = !metronomeMuted; updateStemAudioLevels(); saveTrackSettings(); });
  solo.addEventListener('click', () => { soloedStem = soloedStem === '__metronome' ? null : '__metronome'; updateStemAudioLevels(); saveTrackSettings(); });
  updateMetronomeBpmDisplay();
}

function updateMetronomeBpmDisplay() {
  if (!metronomeBpmInput || !metronomeEffectiveBpm) return;
  const base = Number(metronomeBpmInput.value);
  if (Number.isFinite(base) && base >= 30 && base <= 300) {
    metronomeEffectiveBpm.textContent = `${Math.round(base * audioPlayer.playbackRate * 10) / 10} BPM`;
  } else metronomeEffectiveBpm.textContent = '—';
}

function resetMetronomeGrid() {
  const bpm = Number(metronomeBpmInput?.value);
  if (!Number.isFinite(bpm) || bpm <= 0) return;
  const beatSeconds = 60 / bpm;
  const now = audioPlayer.currentTime || 0;
  const nearestBeat = Math.round(now / beatSeconds) * beatSeconds;
  nextBeatTime = Math.abs(now - nearestBeat) < 0.08 ? nearestBeat : Math.ceil(now / beatSeconds) * beatSeconds;
  lastMetronomeMediaTime = now;
}

async function ensureAudioContext() {
  if (!audioContext) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) throw new Error('This browser does not support the Web Audio API needed for the metronome.');
    audioContext = new AudioContextClass();
  }
  if (audioContext.state === 'suspended') await audioContext.resume();
  return audioContext;
}

function scheduleMetronomeClick(when, beatIndex) {
  if (!audioContext || metronomeMuted || (soloedStem !== null && soloedStem !== '__metronome')) return;
  const volume = Number(metronomeLevelInput?.value ?? 60) / 100;
  const gainValue = masterGain() * volume;
  if (gainValue <= 0) return;
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  oscillator.type = 'sine';
  oscillator.frequency.setValueAtTime(beatIndex % 4 === 0 ? 1320 : 880, when);
  gain.gain.setValueAtTime(0.0001, when);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, gainValue * (beatIndex % 4 === 0 ? 0.42 : 0.28)), when + 0.003);
  gain.gain.exponentialRampToValueAtTime(0.0001, when + 0.055);
  oscillator.connect(gain); gain.connect(audioContext.destination);
  oscillator.start(when); oscillator.stop(when + 0.06);
}

function tickMetronome() {
  if (audioPlayer.paused || audioPlayer.ended || !audioContext) return;
  const bpm = Number(metronomeBpmInput?.value);
  if (!Number.isFinite(bpm) || bpm < 30 || bpm > 300) return;
  const mediaTime = audioPlayer.currentTime || 0;
  const rate = audioPlayer.playbackRate || 1;
  const beatSeconds = 60 / bpm;
  if (lastMetronomeMediaTime !== null && (mediaTime < lastMetronomeMediaTime - 0.05 || mediaTime - lastMetronomeMediaTime > 0.35)) {
    nextBeatTime = Math.ceil((mediaTime - 0.001) / beatSeconds) * beatSeconds;
  }
  if (nextBeatTime === null) {
    const nearestBeat = Math.round(mediaTime / beatSeconds) * beatSeconds;
    nextBeatTime = Math.abs(mediaTime - nearestBeat) < 0.08 ? nearestBeat : Math.ceil(mediaTime / beatSeconds) * beatSeconds;
  }
  const horizon = mediaTime + 0.12 * rate;
  while (nextBeatTime <= horizon) {
    const beatIndex = Math.round(nextBeatTime / beatSeconds);
    const delay = Math.max(0, (nextBeatTime - mediaTime) / rate);
    scheduleMetronomeClick(audioContext.currentTime + delay, beatIndex);
    nextBeatTime += beatSeconds;
  }
  lastMetronomeMediaTime = mediaTime;
}

async function startMetronome() {
  try {
    await ensureAudioContext();
    if (audioPlayer.paused || audioPlayer.ended) return;
    resetMetronomeGrid();
    if (metronomeTimer) clearInterval(metronomeTimer);
    tickMetronome();
    metronomeTimer = setInterval(tickMetronome, 25);
    metronomeMessage.textContent = 'Metronome follows playback speed. At 0.70×, 120 BPM clicks at 84 BPM.';
  } catch (err) {
    metronomeMessage.textContent = err.message;
  }
}
function stopMetronome() {
  if (metronomeTimer) clearInterval(metronomeTimer);
  metronomeTimer = null;
  nextBeatTime = null;
  lastMetronomeMediaTime = null;
}

function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const whole = Math.floor(seconds);
  const hours = Math.floor(whole / 3600);
  const minutes = Math.floor((whole % 3600) / 60);
  const secs = whole % 60;
  return hours ? `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}` : `${minutes}:${String(secs).padStart(2, '0')}`;
}
function updateTimeDisplay() {
  timeDisplay.textContent = `${formatTime(audioPlayer.currentTime)} / ${formatTime(audioPlayer.duration)}`;
}
function updateLoopUI() {
  loopStartDisplay.textContent = loopStart === null ? 'Not set' : formatTime(loopStart);
  loopEndDisplay.textContent = loopEnd === null ? 'Not set' : formatTime(loopEnd);
  loopToggleButton.textContent = loopEnabled ? 'Loop on' : 'Loop off';
  loopToggleButton.setAttribute('aria-pressed', String(loopEnabled));
  loopToggleButton.disabled = loopStart === null || loopEnd === null || loopEnd <= loopStart;
  document.querySelector('.loop-controls').classList.toggle('loop-active', loopEnabled);
}
function setPlaybackSpeed(rate, custom = false) {
  audioPlayer.playbackRate = rate;
  setPitchPreservation(audioPlayer);
  if (custom) {
    speedSelect.value = 'custom';
  } else {
    const option = [...speedSelect.options].find(o => !o.disabled && Math.abs(Number(o.value) - rate) < 0.0001);
    speedSelect.value = option ? option.value : 'custom';
  }
  const originalBpm = Number(sourceBpmInput.value);
  if (sourceBpmInput.value && Number.isFinite(originalBpm) && originalBpm > 0) {
    targetBpmInput.value = (originalBpm * rate).toFixed(1).replace(/\.0$/, '');
  }
  tempoMessage.textContent = `Playback speed: ${rate.toFixed(2)}×${sourceBpmInput.value ? ` · effective song tempo approximately ${Math.round(Number(sourceBpmInput.value) * rate * 10) / 10} BPM` : ''}. Pitch preservation is enabled where supported.`;
  updateMetronomeBpmDisplay(); saveTrackSettings();
}
function resetLoop() {
  loopStart = null;
  loopEnd = null;
  loopEnabled = false;
  updateLoopUI();
  loopMessage.textContent = 'Set A and B while playing or seeking, then turn looping on.';
  saveTrackSettings();
}
rewindButton.addEventListener('click', () => { audioPlayer.currentTime = Math.max(0, (audioPlayer.currentTime || 0) - 5); });
forwardButton.addEventListener('click', () => {
  const end = Number.isFinite(audioPlayer.duration) ? audioPlayer.duration : Infinity;
  audioPlayer.currentTime = Math.min(end, (audioPlayer.currentTime || 0) + 5);
});
playToggleButton.addEventListener('click', async () => {
  if (audioPlayer.paused) {
    try { await audioPlayer.play(); } catch (err) { tempoMessage.textContent = `Playback could not start: ${err.message}`; }
  } else audioPlayer.pause();
});
audioPlayer.addEventListener('play', () => {
  playToggleButton.textContent = 'Pause';
  startMetronome();
  if (mixerMode) playStemPlayers();
});
audioPlayer.addEventListener('pause', () => {
  playToggleButton.textContent = 'Play';
  stopMetronome();
  for (const player of stemPlayers.values()) player.audio.pause();
});
audioPlayer.addEventListener('seeking', () => { syncStemPlayers(true); resetMetronomeGrid(); });
audioPlayer.addEventListener('seeked', () => syncStemPlayers(true));
audioPlayer.addEventListener('ratechange', () => { syncStemPlayers(true); updateMetronomeBpmDisplay(); });
audioPlayer.addEventListener('timeupdate', () => {
  updateTimeDisplay();
  if (loopEnabled && loopStart !== null && loopEnd !== null && audioPlayer.currentTime >= loopEnd) {
    audioPlayer.currentTime = loopStart;
  }
  syncStemPlayers(false);
});
audioPlayer.addEventListener('ended', () => { stopMetronome(); playToggleButton.textContent = 'Play'; });
audioPlayer.addEventListener('loadedmetadata', updateTimeDisplay);
audioPlayer.addEventListener('durationchange', updateTimeDisplay);
setLoopStartButton.addEventListener('click', () => {
  loopStart = audioPlayer.currentTime || 0;
  if (loopEnd !== null && loopEnd <= loopStart) { loopEnd = null; loopEnabled = false; }
  updateLoopUI();
  loopMessage.textContent = loopEnd === null ? 'Start A set. Seek to the end of the section and set B.' : 'Loop start updated.'; saveTrackSettings();
});
setLoopEndButton.addEventListener('click', () => {
  const current = audioPlayer.currentTime || 0;
  if (loopStart === null) {
    loopMessage.textContent = 'Set start (A) first, then set end (B).';
    return;
  }
  if (current <= loopStart) {
    loopMessage.textContent = 'End (B) must be after start (A). Seek further into the track and try again.';
    return;
  }
  loopEnd = current;
  updateLoopUI();
  loopMessage.textContent = `Loop section set: ${formatTime(loopStart)}–${formatTime(loopEnd)}.`; saveTrackSettings();
});
loopToggleButton.addEventListener('click', () => {
  if (loopStart === null || loopEnd === null || loopEnd <= loopStart) return;
  loopEnabled = !loopEnabled;
  if (loopEnabled && (audioPlayer.currentTime < loopStart || audioPlayer.currentTime >= loopEnd)) audioPlayer.currentTime = loopStart;
  updateLoopUI();
  loopMessage.textContent = loopEnabled ? 'Looping this section. Turn Loop off to continue past B.' : 'Loop is off.'; saveTrackSettings();
});
clearLoopButton.addEventListener('click', resetLoop);
speedSelect.addEventListener('change', () => {
  if (speedSelect.value !== 'custom') setPlaybackSpeed(Number(speedSelect.value));
});
applyBpmButton.addEventListener('click', () => {
  const source = Number(sourceBpmInput.value);
  const target = Number(targetBpmInput.value);
  if (!(source > 0 && source <= 400 && target > 0 && target <= 400)) {
    tempoMessage.textContent = 'Enter both the original and practice BPM (between 1 and 400).';
    return;
  }
  const ratio = target / source;
  if (ratio < 0.25 || ratio > 2) {
    tempoMessage.textContent = 'That BPM change would require a playback speed outside the supported 0.25×–2.00× range.';
    return;
  }
  setPlaybackSpeed(ratio, true);
});
updateLoopUI();

// Keyboard shortcuts work when the user is not typing in a control or text field.
document.addEventListener('keydown', event => {
  if (event.altKey || event.ctrlKey || event.metaKey || event.repeat) return;
  const target = event.target;
  if (target instanceof HTMLElement && target.closest('input, select, textarea, button, a, [contenteditable="true"]')) return;
  if (playerArea.hidden) return;
  if (event.code === 'Space') {
    event.preventDefault();
    playToggleButton.click();
  } else if (event.key === 'ArrowLeft') {
    event.preventDefault(); rewindButton.click();
  } else if (event.key === 'ArrowRight') {
    event.preventDefault(); forwardButton.click();
  } else if (event.key.toLowerCase() === 'a') {
    setLoopStartButton.click();
  } else if (event.key.toLowerCase() === 'b') {
    setLoopEndButton.click();
  } else if (event.key.toLowerCase() === 'l' && !loopToggleButton.disabled) {
    loopToggleButton.click();
  }
});

function loadCompletedTrack(job, fromLibrary = false) {
  audioPlayer.pause(); stopMetronome(); stopStemPlayers();
  metronomeMuted = false; metronomeBpmInput = null; metronomeLevelInput = null; metronomeLevelValue = null; metronomeMuteButton = null; metronomeSoloButton = null;
  playerArea.hidden = false; mixerEmptyState.hidden = true; separatorPanel.hidden = true; jobProgress.hidden = true; currentJobId = job.id;
  document.querySelector('#result-filename').textContent = job.title || (job.filename || 'Backing track').replace(/\.[^.]+$/, '');
  audioPlayer.src = job.backing_url; audioPlayer.volume = masterGain(); audioPlayer.playbackRate = 1; speedSelect.value = '1';
  loopStart = null; loopEnd = null; loopEnabled = false; updateLoopUI(); updateTimeDisplay();
  sourceBpmInput.value = job.bpm == null ? '' : String(job.bpm);
  downloadLink.href = job.download_url; currentStems = job.stems || {};
  mixerModelLabel.textContent = job.model === 'htdemucs_6s' ? '6 stems · vocals, drums, bass, guitar, piano, other' : '4 stems · vocals, drums, bass, other';
  renderStems(currentStems);
  restoreTrackSettings(job.id);
  jobMessage.textContent = `${job.title || (job.filename || 'Track').replace(/\.[^.]+$/, '')}${job.artist ? ' · ' + job.artist : ''}${fromLibrary ? ' · Loaded from your library' : ' · Saved to your library'}`;
  setProgress('completed');
  submitButton.disabled = false; submitButton.querySelector('span:first-child').textContent = 'Generate another backing track';
}

async function pollJob(id) {
  try {
    const response = await fetch(`/api/jobs/${id}`);
    const job = await response.json();
    if (!response.ok) throw new Error(job.detail || 'Could not read job status.');
    jobMessage.textContent = job.progress || job.status;
    jobProgress.hidden = false;
    setProgress(job.status);
    if (job.status === 'completed') {
      clearInterval(pollTimer); pollTimer = null;
      loadCompletedTrack(job, false);
      await loadLibrary();
      submitButton.disabled = false; submitButton.querySelector('span:first-child').textContent = 'Generate another backing track';
    } else if (job.status === 'failed') {
      clearInterval(pollTimer); pollTimer = null;
      showError(job.error || 'Processing failed.');
      submitButton.disabled = false; submitButton.querySelector('span:first-child').textContent = 'Try again';
    }
  } catch (err) {
    clearInterval(pollTimer); pollTimer = null; showError(err.message);
    submitButton.disabled = false;
  }
}
form.addEventListener('submit', async e => {
  e.preventDefault();
  if (!fileInput.files.length) return;
  if (pollTimer) clearInterval(pollTimer);
  separatorPanel.hidden = false; errorBox.hidden = true; jobProgress.hidden = false; mixerEmptyState.hidden = false; playerArea.hidden = true; currentJobId = null;
  audioPlayer.pause(); stopMetronome(); audioPlayer.muted = false; audioPlayer.removeAttribute('src'); audioPlayer.load();
  stopStemPlayers(); mixerMode = false; soloedStem = null; stemsList.hidden = false; stemsToggle.textContent = 'Use backing mix';
  jobMessage.textContent = 'Preparing your new track…'; progressBar.style.width = '3%';
  submitButton.disabled = true; submitButton.querySelector('span:first-child').textContent = 'Processing…';
  const data = new FormData(form);
  try {
    const response = await fetch('/api/jobs', {method:'POST', body:data});
    const result = await response.json();
    if (!response.ok) throw new Error(result.detail || 'Upload failed.');
    jobMessage.textContent = 'Job queued…';
    await pollJob(result.id);
    if (!['completed','failed'].includes((await (await fetch(`/api/jobs/${result.id}`)).json()).status)) {
      pollTimer = setInterval(() => pollJob(result.id), 1800);
    }
  } catch (err) {
    showError(err.message); submitButton.disabled = false; submitButton.querySelector('span:first-child').textContent = 'Generate backing track';
  }
});
stemsToggle.addEventListener('click', () => setMixerMode(!mixerMode));


// Jamloom session coordination prototype. Audio streaming and automatic player
// synchronisation are deliberately not part of this first session-server step.
const sessionName = document.querySelector('#session-name');
const sessionTitle = document.querySelector('#session-title');
const createSessionButton = document.querySelector('#create-session');
const joinSessionButton = document.querySelector('#join-session');
const showJoinFormButton = document.querySelector('#show-join-form');
const joinSessionForm = document.querySelector('#join-session-form');
const cancelJoinButton = document.querySelector('#cancel-join');
const joinCodeInput = document.querySelector('#join-code');
const sessionMessage = document.querySelector('#session-message');
const sessionRoom = document.querySelector('#session-room');
const sessionCode = document.querySelector('#session-code');
const sessionStatus = document.querySelector('#session-status');
const participantList = document.querySelector('#participant-list');
const sessionPosition = document.querySelector('#session-position');
const sessionBpm = document.querySelector('#session-bpm');
const sessionPlay = document.querySelector('#session-play');
const sessionPause = document.querySelector('#session-pause');
const leaveSessionButton = document.querySelector('#leave-session');
const copySessionCodeButton = document.querySelector('#copy-session-code');
let activeSession = null;
let activeInviteCode = null;
let participantToken = null;
let sessionSocket = null;
let applyingRemoteSession = false;

function setJoinFormVisible(visible) {
  joinSessionForm.hidden = !visible;
  showJoinFormButton.hidden = visible;
  showJoinFormButton.setAttribute('aria-expanded', String(visible));
  if (visible) joinCodeInput.focus();
}
showJoinFormButton.addEventListener('click', () => setJoinFormVisible(true));
cancelJoinButton.addEventListener('click', () => setJoinFormVisible(false));
joinCodeInput.addEventListener('keydown', event => {
  if (event.key === 'Enter') { event.preventDefault(); joinSessionButton.click(); }
});

function setSessionMessage(message, isError = false) {
  sessionMessage.textContent = message;
  sessionMessage.classList.toggle('is-error', isError);
}
function sessionHeaders() {
  return {'Content-Type': 'application/json', 'X-Participant-Token': participantToken || ''};
}
function renderSession(session) {
  activeSession = session;
  sessionRoom.hidden = false;
  sessionCode.textContent = activeInviteCode || '------';
  const state = session.state || {};
  sessionStatus.textContent = `Playback: ${state.playing ? 'playing' : 'paused'} · Position: ${(state.position_seconds || 0).toFixed(1)}s${state.bpm ? ` · ${state.bpm} BPM` : ''}`;
  applyingRemoteSession = true;
  sessionPosition.value = Number(state.position_seconds || 0).toFixed(1);
  sessionBpm.value = state.bpm ?? '';
  applyingRemoteSession = false;
  participantList.replaceChildren();
  for (const participant of session.participants || []) {
    const item = document.createElement('div'); item.className = 'participant-item';
    const name = document.createElement('strong'); name.textContent = participant.display_name;
    const detail = document.createElement('span'); detail.textContent = `${participant.role} · ${participant.connected ? 'connected' : 'offline'}`;
    item.append(name, detail); participantList.append(item);
  }
}
function connectSessionSocket() {
  if (!activeSession || !participantToken) return;
  if (sessionSocket) sessionSocket.close();
  const scheme = location.protocol === 'https:' ? 'wss:' : 'ws:';
  sessionSocket = new WebSocket(`${scheme}//${location.host}/api/sessions/${activeSession.id}/ws?token=${encodeURIComponent(participantToken)}`);
  sessionSocket.addEventListener('open', () => setSessionMessage('Connected to Jamloom session.'));
  sessionSocket.addEventListener('message', event => {
    let message; try { message = JSON.parse(event.data); } catch { return; }
    if (message.session) {
      renderSession(message.session);
    }
    if (message.type === 'error') setSessionMessage(message.detail || 'Session error.', true);
  });
  sessionSocket.addEventListener('close', () => {
    if (activeSession) setSessionMessage('Session connection closed. You can reconnect by rejoining the invite code.', true);
  });
  sessionSocket.addEventListener('error', () => setSessionMessage('WebSocket connection failed.', true));
}
async function sessionRequest(url, options = {}) {
  const response = await fetch(url, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.detail || `Request failed (${response.status}).`);
  return data;
}
async function enterSession(data) {
  activeSession = data;
  activeInviteCode = data.invite_code || joinCodeInput.value.trim().toUpperCase();
  participantToken = data.participant_token;
  renderSession(data);
  connectSessionSocket();
}
createSessionButton.addEventListener('click', async () => {
  createSessionButton.disabled = true;
  setSessionMessage('Creating session…');
  try {
    const data = await sessionRequest('/api/sessions', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({title:sessionTitle.value.trim() || 'Jam session', display_name:sessionName.value.trim() || 'Host', track_job_id:currentJobId})});
    await enterSession(data);
    setJoinFormVisible(false);
    setSessionMessage('Session created. Share the invite code with another browser.');
  } catch (err) {
    console.error('Jamloom could not create a session:', err);
    setSessionMessage(`Could not create session: ${err.message}`, true);
  } finally {
    createSessionButton.disabled = false;
  }
});
joinSessionButton.addEventListener('click', async () => {
  try {
    const data = await sessionRequest('/api/sessions/join', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({invite_code:joinCodeInput.value.trim().toUpperCase(), display_name:sessionName.value.trim() || 'Guest'})});
    await enterSession(data);
    setJoinFormVisible(false);
    setSessionMessage('Joined session.');
  } catch (err) { setSessionMessage(err.message, true); }
});
async function shareSessionState(patch) {
  if (!activeSession || !participantToken) { setSessionMessage('Create or join a session first.', true); return; }
  try {
    if (sessionSocket?.readyState === WebSocket.OPEN) {
      sessionSocket.send(JSON.stringify({type:'state_update', state:patch}));
    } else {
      const data = await sessionRequest(`/api/sessions/${activeSession.id}/state`, {method:'POST', headers:sessionHeaders(), body:JSON.stringify(patch)});
      renderSession(data);
    }
  } catch (err) { setSessionMessage(err.message, true); }
}
sessionPlay.addEventListener('click', () => shareSessionState({playing:true, position_seconds:Math.max(0, Number(sessionPosition.value) || 0), ...(sessionBpm.value ? {bpm:Number(sessionBpm.value)} : {})}));
sessionPause.addEventListener('click', () => shareSessionState({playing:false, position_seconds:Math.max(0, Number(sessionPosition.value) || 0), ...(sessionBpm.value ? {bpm:Number(sessionBpm.value)} : {})}));
sessionPosition.addEventListener('change', () => { if (!applyingRemoteSession) shareSessionState({position_seconds:Math.max(0, Number(sessionPosition.value) || 0)}); });
sessionBpm.addEventListener('change', () => { if (!applyingRemoteSession && sessionBpm.value) shareSessionState({bpm:Number(sessionBpm.value)}); });
leaveSessionButton.addEventListener('click', async () => {
  if (!activeSession || !participantToken) return;
  try { await sessionRequest(`/api/sessions/${activeSession.id}/participants/me`, {method:'DELETE', headers:sessionHeaders()}); } catch {}
  if (sessionSocket) sessionSocket.close();
  sessionSocket = null; activeSession = null; activeInviteCode = null; participantToken = null;
  sessionRoom.hidden = true; setSessionMessage('You left the session.');
});
copySessionCodeButton.addEventListener('click', async () => {
  try { await navigator.clipboard.writeText(sessionCode.textContent); setSessionMessage('Invite code copied.'); }
  catch { setSessionMessage(`Invite code: ${sessionCode.textContent}`); }
});
joinCodeInput.addEventListener('input', () => { joinCodeInput.value = joinCodeInput.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0,6); });


// Shared server-side library: all browsers connected to this instance see the same tracks.
loadLibrary();
