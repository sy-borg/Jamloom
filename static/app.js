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
const beginningButton = document.querySelector('#beginning-button');
const rewindButton = document.querySelector('#rewind-button');
const playToggleButton = document.querySelector('#play-toggle-button');
const forwardButton = document.querySelector('#forward-button');
const timeDisplay = document.querySelector('#time-display');
const playbackSeek = document.querySelector('#playback-seek');
const practiceModeToggle = document.querySelector('#practice-mode-toggle');
let practiceMode = true;
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
const libraryStorageSummary = document.querySelector('#library-storage-summary');
const librarySearch = document.querySelector('#library-search');
const librarySort = document.querySelector('#library-sort');
const libraryShowMore = document.querySelector('#library-show-more');
const LIBRARY_PAGE_SIZE = 5;
let libraryVisibleLimit = LIBRARY_PAGE_SIZE;
const editTrackDialog = document.querySelector('#edit-track-dialog');
const editTrackForm = document.querySelector('#edit-track-form');
const editTrackStatus = document.querySelector('#edit-track-status');
let editingLibraryTrack = null;
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
let currentTrackBpm = null;
let currentTrackTimeSignature = '';
let audioContext = null;
let metronomeTimer = null;
let nextBeatAudioTime = null;
let nextBeatIndex = 0;
let metronomeDownbeatOffset = 0;
let currentPitchAnalysis = null;
let activeNoteEventIndex = -2;
let selectedNoteEventIndex = -1;
let arrangementDirty = false;
let noteAnalysisPollTimer = null;
let noteAnalysisRequestToken = 0;
let noteAnalysisAbortController = null;
let notePlaybackAnimationFrame = null;
let notePlaybackInterval = null;
let noteAuditionEndTime = null;
let noteStemAuditionTimer = null;
let noteStemAuditionPlayer = null;
let noteStemAuditionWasMuted = false;
let screenWakeLock = null;
let screenWakeLockRequest = null;

async function requestScreenWakeLock() {
  if (!('wakeLock' in navigator) || document.hidden || audioPlayer.paused || audioPlayer.ended) return;
  if (screenWakeLock && !screenWakeLock.released) return;
  if (screenWakeLockRequest) return screenWakeLockRequest;

  screenWakeLockRequest = navigator.wakeLock.request('screen').then(sentinel => {
    // Playback may have paused or the page may have been backgrounded while
    // the browser was resolving the request.
    if (document.hidden || audioPlayer.paused || audioPlayer.ended) {
      sentinel.release().catch(() => {});
      return;
    }
    screenWakeLock = sentinel;
    sentinel.addEventListener('release', () => {
      if (screenWakeLock === sentinel) screenWakeLock = null;
    }, { once: true });
  }).catch(error => {
    // Wake Lock is optional; unsupported browsers and power policies should
    // never interfere with playback.
    console.debug('Jamloom could not acquire a screen wake lock:', error);
  }).finally(() => {
    screenWakeLockRequest = null;
  });
  return screenWakeLockRequest;
}

async function releaseScreenWakeLock() {
  const sentinel = screenWakeLock;
  screenWakeLock = null;
  if (sentinel && !sentinel.released) {
    try { await sentinel.release(); } catch (error) {
      console.debug('Jamloom could not release the screen wake lock:', error);
    }
  }
}
const noteStemSelect = document.querySelector('#note-stem-select');
const analyzeNotesButton = document.querySelector('#analyze-notes-button');
let lastNoteStemSelectionHandled = null;

const noteAnalysisStatus = document.querySelector('#note-analysis-status');
const currentNoteName = document.querySelector('#current-note-name');
const currentNoteLabel = document.querySelector('#current-note-label');
const currentNoteTime = document.querySelector('#current-note-time');
const noteEventsContainer = document.querySelector('#note-events');
const guitarTabView = document.querySelector('#guitar-tab-view');
const noteEditor = document.querySelector('.note-editor');
function setNoteEditorVisible(visible) { noteEditor.hidden = !visible; }
const editNotePitch = document.querySelector('#edit-note-pitch');
const editNoteStart = document.querySelector('#edit-note-start');
const editNoteEnd = document.querySelector('#edit-note-end');
const editNoteString = document.querySelector('#edit-note-string');
const editNoteFret = document.querySelector('#edit-note-fret');
const applyNoteEditButton = document.querySelector('#apply-note-edit');
const addNoteEventButton = document.querySelector('#add-note-event');
const deleteNoteEventButton = document.querySelector('#delete-note-event');
const saveNoteArrangementButton = document.querySelector('#save-note-arrangement');
const noteEditorStatus = document.querySelector('#note-editor-status');
const musicxmlFile = document.querySelector('#musicxml-file');
const importMusicxmlButton = document.querySelector('#import-musicxml-button');
const musicxmlStatus = document.querySelector('#musicxml-status');
const musicxmlPartLabel = document.querySelector('#musicxml-part-label');
const musicxmlPartSelect = document.querySelector('#musicxml-part-select');
const musicxmlScore = document.querySelector('#musicxml-score');
const musicxmlTimingControls = document.querySelector('#musicxml-timing-controls');
const musicxmlTempoInput = document.querySelector('#musicxml-tempo');
const musicxmlOffsetInput = document.querySelector('#musicxml-offset');
const musicxmlResetTiming = document.querySelector('#musicxml-reset-timing');
let importedMusicXml = null;
let musicXmlDefaultTempo = 120;
function musicXmlTimingKey() { return `jamloom-musicxml-timing-${currentJobId}`; }
function readMusicXmlTiming() {
  const saved = localStorage.getItem(musicXmlTimingKey());
  if (saved) { try { const value = JSON.parse(saved); return {tempo: Number(value.tempo) || musicXmlDefaultTempo, offset: Number(value.offset) || 0}; } catch {} }
  return {tempo: musicXmlDefaultTempo, offset: 0};
}
function saveMusicXmlTiming() {
  if (!currentJobId) return;
  const tempo = Math.min(300, Math.max(20, Number(musicxmlTempoInput.value) || musicXmlDefaultTempo));
  const offset = Math.min(120, Math.max(-120, Number(musicxmlOffsetInput.value) || 0));
  localStorage.setItem(musicXmlTimingKey(), JSON.stringify({tempo, offset}));
  renderMusicXmlPart();
}
function renderMusicXmlPart() {
  if (!importedMusicXml || !currentJobId) return;
  const part = importedMusicXml.parts[Number(musicxmlPartSelect.value) || 0];
  if (!part) return;
  musicxmlScore.replaceChildren();
  const tempo = Math.min(300, Math.max(20, Number(musicxmlTempoInput.value) || musicXmlDefaultTempo));
  const audioOffset = Number(musicxmlOffsetInput.value) || 0;
  const measureSeconds = measure => (Number(measure.beats || 4) * 60 / Math.max(tempo, 1));
  let offset = 0;
  for (const measure of part.measures) {
    const measureStart = offset;
    const card = document.createElement('button'); card.type = 'button'; card.className = 'musicxml-measure';
    card.dataset.start = String(measureStart); card.title = `Seek to measure ${measure.number}`;
    const heading = document.createElement('strong'); heading.textContent = `Measure ${measure.number}`; card.append(heading);
    const tab = document.createElement('div'); tab.className = 'musicxml-measure-notes';
    const notes = [...measure.notes].sort((a,b)=>a.beat-b.beat);
    if (!notes.length) { const empty = document.createElement('span'); empty.className='musicxml-empty-measure'; empty.textContent='—'; tab.append(empty); }
    for (const note of notes) {
      const item = document.createElement('span'); item.className = 'musicxml-note';
      const main = document.createElement('strong');
      main.textContent = note.string != null && note.fret != null ? `${note.string}|${note.fret}` : (note.pitch || '♪');
      const beat = document.createElement('small'); beat.textContent = `beat ${(Number(note.beat)+1).toFixed(2).replace(/\.00$/,'')}`;
      item.append(main, beat); tab.append(item);
    }
    card.append(tab); card.addEventListener('click', () => { audioPlayer.currentTime = Math.max(0, measureStart + audioOffset); });
    musicxmlScore.append(card); offset += measureSeconds(measure);
  }
  musicxmlScore.hidden = false; musicxmlPartLabel.hidden = importedMusicXml.parts.length < 2;
  musicxmlStatus.textContent = `${part.name} · ${part.measures.length} measures · ${importedMusicXml.tempo || 'No'} BPM${importedMusicXml.time_signature ? ` · ${importedMusicXml.time_signature}` : ''}. Click a measure to seek there. Fret positions appear when supplied by the score.`;
  updateMusicXmlPlayhead();
}
function updateMusicXmlPlayhead() {
  if (musicxmlScore.hidden) return;
  const time = (audioPlayer.currentTime || 0) - (Number(musicxmlOffsetInput.value) || 0);
  for (const card of musicxmlScore.querySelectorAll('.musicxml-measure')) {
    const start = Number(card.dataset.start);
    const next = card.nextElementSibling;
    const end = next ? Number(next.dataset.start) : Infinity;
    card.classList.toggle('active', time >= start && time < end);
  }
}
async function loadMusicXml() {
  if (!currentJobId) return;
  importedMusicXml = null; musicxmlScore.replaceChildren(); musicxmlScore.hidden = true; musicxmlPartLabel.hidden = true;
  try {
    const response = await fetch(`/api/library/${currentJobId}/musicxml`);
    if (response.status === 404) { musicxmlStatus.textContent = 'No score imported for this song yet.'; return; }
    const data = await response.json(); if (!response.ok) throw new Error(data.detail || 'Could not load score.');
    importedMusicXml = data; musicXmlDefaultTempo = Number(data.tempo || currentTrackBpm || 120); const timing = readMusicXmlTiming(); musicxmlTempoInput.value = String(timing.tempo); musicxmlOffsetInput.value = String(timing.offset); musicxmlPartSelect.replaceChildren();
    data.parts.forEach((part, index) => { const option = document.createElement('option'); option.value=String(index); option.textContent=part.name; musicxmlPartSelect.append(option); });
    renderMusicXmlPart();
  } catch (error) { musicxmlStatus.textContent = `Could not load MusicXML: ${error.message}`; }
}
importMusicxmlButton.addEventListener('click', async () => {
  if (!currentJobId) { musicxmlStatus.textContent = 'Open a song from your library first.'; return; }
  if (!musicxmlFile.files.length) { musicxmlStatus.textContent = 'Choose a .musicxml or .xml file first.'; return; }
  const form = new FormData(); form.append('file', musicxmlFile.files[0]); importMusicxmlButton.disabled = true; musicxmlStatus.textContent = 'Importing score…';
  try { const response = await fetch(`/api/library/${currentJobId}/musicxml`, {method:'POST', body:form}); const data = await response.json(); if (!response.ok) throw new Error(data.detail || 'Import failed.'); importedMusicXml=data; musicXmlDefaultTempo=Number(data.tempo || currentTrackBpm || 120); const timing=readMusicXmlTiming(); musicxmlTempoInput.value=String(timing.tempo); musicxmlOffsetInput.value=String(timing.offset); musicxmlPartSelect.replaceChildren(); data.parts.forEach((part,index)=>{const option=document.createElement('option');option.value=String(index);option.textContent=part.name;musicxmlPartSelect.append(option);}); renderMusicXmlPart(); musicxmlFile.value=''; }
  catch(error) { musicxmlStatus.textContent = `Could not import score: ${error.message}`; } finally { importMusicxmlButton.disabled=false; }
});
musicxmlPartSelect.addEventListener('change', renderMusicXmlPart);
musicxmlTempoInput.addEventListener('change', saveMusicXmlTiming);
musicxmlOffsetInput.addEventListener('change', saveMusicXmlTiming);
musicxmlResetTiming.addEventListener('click', () => { musicxmlTempoInput.value = String(musicXmlDefaultTempo); musicxmlOffsetInput.value = '0'; saveMusicXmlTiming(); });
audioPlayer.addEventListener('timeupdate', updateMusicXmlPlayhead);


function formatNoteTime(seconds) { return formatTime(seconds); }
function renderNoteEvents() {
  if (!currentPitchAnalysis?.events?.length) {
    guitarTabView.hidden = true; guitarTabView.replaceChildren();
    noteEventsContainer.replaceChildren();
    const empty = document.createElement('span'); empty.className = 'note-events-empty';
    empty.textContent = 'No notes detected. Try another stem or a different section of the song.';
    noteEventsContainer.append(empty); return;
  }
  const time = audioPlayer.currentTime || 0;
  const events = currentPitchAnalysis.events;
  let index = events.findIndex(event => event.start <= time && event.end > time);
  if (index < 0) index = events.findIndex(event => event.start > time);
  if (index < 0) index = Math.max(0, events.length - 1);
  // Build shared onset columns once so the tab/fretboard and note buttons use identical widths.
  // Group note onsets in linear time. Searching the growing column array for
  // every event becomes quadratic for long recordings and can freeze mobile UI.
  const columnsByOnset = new Map();
  for (let eventIndex = 0; eventIndex < events.length; eventIndex++) {
    const event = events[eventIndex];
    const onset = Math.round(Number(event.start) * 100);
    let column = columnsByOnset.get(onset);
    if (!column) {
      column = {onset, events: []};
      columnsByOnset.set(onset, column);
    }
    column.events.push({event, eventIndex});
  }
  const allColumns = [...columnsByOnset.values()];
  let activeColumnIndex = allColumns.findIndex(column => column.events.some(item => item.eventIndex === activeNoteEventIndex));
  if (activeColumnIndex < 0) activeColumnIndex = allColumns.findIndex(column => column.events.some(item => item.eventIndex === index));
  if (activeColumnIndex < 0) activeColumnIndex = allColumns.findIndex(column => column.onset > Math.round(time * 100));
  if (activeColumnIndex < 0) activeColumnIndex = Math.max(0, allColumns.length - 1);
  const visibleStart = Math.max(0, activeColumnIndex - 3);
  const columns = allColumns.slice(visibleStart, visibleStart + 10);
  const activeEvent = activeNoteEventIndex >= 0 ? events[activeNoteEventIndex] : null;
  const activeOnset = activeEvent ? Math.round(Number(activeEvent.start) * 100) : null;

  noteEventsContainer.replaceChildren();
  if (noteStemSelect.value === 'guitar' || noteStemSelect.value === 'bass') {
    guitarTabView.hidden = false; guitarTabView.replaceChildren();
    const isBass = noteStemSelect.value === 'bass';
    const tuning = isBass ? [{n:1,label:'G'}, {n:2,label:'D'}, {n:3,label:'A'}, {n:4,label:'E'}] : [{n:1,label:'e'}, {n:2,label:'B'}, {n:3,label:'G'}, {n:4,label:'D'}, {n:5,label:'A'}, {n:6,label:'E'}];
    const heading = document.createElement('div'); heading.className = 'guitar-tab-heading'; heading.textContent = isBass ? 'Bass tab · Standard 4-string tuning (G–D–A–E)' : 'Guitar tab · Standard tuning (E–B–G–D–A–E)'; guitarTabView.append(heading);
    tuning.forEach(stringInfo => {
      const row = document.createElement('div'); row.className = 'guitar-tab-string'; row.style.gridTemplateColumns = `18px repeat(${columns.length}, var(--note-column-width, 72px))`;
      const label = document.createElement('span'); label.className = 'guitar-tab-label'; label.textContent = stringInfo.label; row.append(label);
      columns.forEach(column => {
        const cell = document.createElement('span'); cell.className = 'guitar-tab-cell';
        if (activeOnset !== null && column.onset === activeOnset) cell.classList.add('active-chord');
        if (column.events.some(item => item.eventIndex === selectedNoteEventIndex)) cell.classList.add('selected');
        const positions = column.events.map(item => ({...item, position:getInstrumentPosition(item.event.midi, item.event.string, item.event.fret)})).filter(item => item.position?.string === stringInfo.n);
        if (positions.length) {
          const fret = document.createElement('span'); fret.className = 'guitar-tab-fret';
          fret.textContent = positions.map(item => item.position.fret).join('/');
          if (activeOnset !== null && column.onset === activeOnset) fret.classList.add('active-fret');
          cell.append(fret);
          cell.title = positions.map(item => `${item.event.note} · ${formatNoteTime(item.event.start)}`).join(', ');
        } else { cell.textContent = '─'; }
        row.append(cell);
      });
      guitarTabView.append(row);
    });
  } else { guitarTabView.hidden = true; guitarTabView.replaceChildren(); }

  columns.forEach(column => {
    const columnEl = document.createElement('div'); columnEl.className = 'note-event-column';
    column.events.forEach(({event, eventIndex}) => {
      const button = document.createElement('button'); button.type = 'button'; button.className = 'note-event';
      if (activeOnset !== null && column.onset === activeOnset) button.classList.add('active');
      if (eventIndex === selectedNoteEventIndex) button.classList.add('selected');
      const noteLine = document.createElement('span'); noteLine.className = 'note-event-line note-event-line-primary';
      const note = document.createElement('strong'); note.textContent = event.note;
      const tabPosition = document.createElement('span'); tabPosition.className = 'note-event-tab';
      const tab = getInstrumentPosition(event.midi, event.string, event.fret);
      tabPosition.textContent = tab ? `${tab.string}|${tab.fret}` : 'Tab —';
      noteLine.append(note, tabPosition);
      const detailLine = document.createElement('span'); detailLine.className = 'note-event-line note-event-line-details';
      const frequency = document.createElement('span'); frequency.className = 'note-event-frequency'; frequency.textContent = event.frequency_hz != null ? `${event.frequency_hz.toFixed(1)} Hz` : '— Hz';
      const timestamp = document.createElement('span'); timestamp.className = 'note-event-time'; timestamp.textContent = formatNoteTime(event.start);
      detailLine.append(frequency, timestamp);
      button.append(noteLine, detailLine);
      button.addEventListener('click', async () => {
        const wasPaused = audioPlayer.paused;
        selectedNoteEventIndex = eventIndex;
        // Seeking is unconditional, but note audition must never start the main player.
        audioPlayer.currentTime = Number(event.start) || 0;
        updateCurrentNote(true);
        if (wasPaused) {
          setNoteEditorVisible(true);
          fillNoteEditor();
          await auditionSelectedStemNote(event);
        }
      });
      columnEl.append(button);
    });
    noteEventsContainer.append(columnEl);
  });
}

async function auditionSelectedStemNote(event) {
  stopNoteStemAudition();
  const stemName = noteStemSelect.value;
  const player = stemPlayers.get(stemName);
  if (!player || !currentStems[stemName]) return;
  const audio = player.audio;
  // In backing-mix mode stem URLs are deliberately released to save browser connections.
  if (!audio.getAttribute('src') && player.savedSrc) { audio.src = player.savedSrc; audio.load(); }
  // Audition only the selected instrument, with a little context around the note.
  const start = Math.max(0, (Number(event.start) || 0) - 0.12);
  for (const other of stemPlayers.values()) other.audio.pause();
  noteStemAuditionPlayer = player;
  noteStemAuditionWasMuted = audio.muted;
  audio.muted = false;
  try {
    if (audio.readyState < 1) {
      await new Promise((resolve, reject) => {
        const loaded = () => { cleanup(); resolve(); };
        const failed = () => { cleanup(); reject(new Error('Stem audio could not be loaded')); };
        const cleanup = () => { audio.removeEventListener('loadedmetadata', loaded); audio.removeEventListener('error', failed); };
        audio.addEventListener('loadedmetadata', loaded, { once: true });
        audio.addEventListener('error', failed, { once: true });
      });
    }
    const songDuration = Number.isFinite(audio.duration) ? audio.duration : Infinity;
    const end = Math.min(songDuration, Math.max(Number(event.end) || (Number(event.start) || 0) + 0.35, (Number(event.start) || 0) + 0.35) + 0.18);
    audio.currentTime = Math.min(start, Number.isFinite(audio.duration) ? audio.duration : start);
    await audio.play();
    noteStemAuditionTimer = setInterval(() => {
      if (!noteStemAuditionPlayer || audio.currentTime >= end || audio.ended || audio.paused) stopNoteStemAudition();
    }, 40);
  } catch (error) {
    stopNoteStemAudition();
    console.debug('Jamloom could not audition this stem note:', error);
  }
}
function stopNoteStemAudition() {
  if (noteStemAuditionTimer !== null) clearInterval(noteStemAuditionTimer);
  noteStemAuditionTimer = null;
  if (noteStemAuditionPlayer) {
    const player = noteStemAuditionPlayer;
    player.audio.pause();
    player.audio.muted = noteStemAuditionWasMuted;
    if (!mixerMode && player.savedSrc && player.audio.getAttribute('src')) {
      player.audio.removeAttribute('src');
      player.audio.load();
    }
  }
  noteStemAuditionPlayer = null;
}

function midiToNote(midi) {
  const names = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
  return `${names[midi % 12]}${Math.floor(midi / 12) - 1}`;
}
function parseNotePitch(value) {
  const match = String(value).trim().replace(/♯/g, '#').replace(/♭/g, 'b').match(/^([A-Ga-g])([#b]?)(-?\d)$/);
  if (!match) return null;
  const semitones = {C:0,D:2,E:4,F:5,G:7,A:9,B:11};
  let midi = (Number(match[3]) + 1) * 12 + semitones[match[1].toUpperCase()];
  if (match[2] === '#') midi += 1;
  if (match[2] === 'b') midi -= 1;
  return midi >= 0 && midi <= 127 ? midi : null;
}
function fillNoteEditor() {
  const event = currentPitchAnalysis?.events?.[selectedNoteEventIndex];
  const enabled = Boolean(event);
  editNotePitch.disabled = !enabled; editNoteStart.disabled = !enabled; editNoteEnd.disabled = !enabled;
  editNoteString.disabled = !enabled; editNoteFret.disabled = !enabled;
  applyNoteEditButton.disabled = !enabled; deleteNoteEventButton.disabled = !enabled;
  if (!event) return;
  editNotePitch.value = event.note || midiToNote(event.midi);
  editNoteStart.value = Number(event.start).toFixed(2);
  editNoteEnd.value = Number(event.end).toFixed(2);
  const tab = getInstrumentPosition(event.midi, event.string, event.fret);
  editNoteString.value = tab ? String(tab.string) : '';
  editNoteFret.value = tab ? String(tab.fret) : '';
}
function markArrangementDraft(message = 'Unsaved changes. Save the arrangement to keep them with this track.') {
  arrangementDirty = true;
  noteEditorStatus.textContent = message;
  saveNoteArrangementButton.textContent = 'Save arrangement *';
}
function noteFrequency(midi) { return 440 * (2 ** ((midi - 69) / 12)); }
// Standard guitar tuning, MIDI pitches for strings 1 (high E) through 6 (low E).
const GUITAR_OPEN_MIDI = {1:64, 2:59, 3:55, 4:50, 5:45, 6:40};
function getGuitarPosition(midi, stringValue = null, fretValue = null) {
  const string = Number(stringValue), fret = Number(fretValue);
  if (Number.isInteger(string) && GUITAR_OPEN_MIDI[string] != null && Number.isInteger(fret) && fret >= 0 && fret <= 24 && GUITAR_OPEN_MIDI[string] + fret === Number(midi)) return {string, fret};
  const candidates = Object.entries(GUITAR_OPEN_MIDI).map(([s, open]) => ({string:Number(s), fret:Number(midi)-open})).filter(p => p.fret >= 0 && p.fret <= 24);
  candidates.sort((a,b) => a.fret-b.fret || a.string-b.string);
  return candidates[0] || null;
}
// Standard four-string bass tuning, string 1 (high G) through string 4 (low E).
const BASS_OPEN_MIDI = {1: 43, 2: 38, 3: 33, 4: 28};
function getInstrumentPosition(midi, stringValue = null, fretValue = null) {
  const openMidi = noteStemSelect.value === 'bass' ? BASS_OPEN_MIDI : GUITAR_OPEN_MIDI;
  const string = Number(stringValue), fret = Number(fretValue);
  if (Number.isInteger(string) && openMidi[string] != null && Number.isInteger(fret) && fret >= 0 && fret <= 24 && openMidi[string] + fret === Number(midi)) return {string, fret};
  const candidates = Object.entries(openMidi).map(([s, open]) => ({string:Number(s), fret:Number(midi)-open})).filter(p => p.fret >= 0 && p.fret <= 24);
  candidates.sort((a,b) => a.fret-b.fret || a.string-b.string);
  return candidates[0] || null;
}
function updatePitchFromFretboardPosition() {
  const string = Number(editNoteString.value);
  const fret = Number(editNoteFret.value);
  const openMidi = noteStemSelect.value === 'bass' ? BASS_OPEN_MIDI : GUITAR_OPEN_MIDI;
  if (!editNoteString.value || editNoteFret.value === '' || openMidi[string] == null || !Number.isInteger(fret) || fret < 0 || fret > 24) return;
  const midi = openMidi[string] + fret;
  editNotePitch.value = midiToNote(midi);
  noteEditorStatus.textContent = `String ${string}, fret ${fret} gives ${midiToNote(midi)} (${noteFrequency(midi).toFixed(1)} Hz). Apply tone edit, then save the arrangement.`;
}
editNoteString.addEventListener('change', () => {
  // A chosen string/fret is the source of truth. If a fret is already entered,
  // changing strings immediately recalculates the pitch.
  updatePitchFromFretboardPosition();
});
editNoteFret.addEventListener('change', updatePitchFromFretboardPosition);
applyNoteEditButton.addEventListener('click', () => {
  const event = currentPitchAnalysis?.events?.[selectedNoteEventIndex];
  if (!event) return;
  const midi = parseNotePitch(editNotePitch.value);
  const start = Number(editNoteStart.value), end = Number(editNoteEnd.value);
  if (midi === null) { noteEditorStatus.textContent = 'Enter a pitch such as A1, C#2 or Bb2.'; return; }
  if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end <= start || end > Number(currentPitchAnalysis.duration || audioPlayer.duration || Infinity)) {
    noteEditorStatus.textContent = 'Check the timing: start must be before end and both must be within the song.'; return;
  }
  const selectedString = editNoteString.value ? Number(editNoteString.value) : null;
  const selectedFret = editNoteFret.value !== '' ? Number(editNoteFret.value) : null;
  if ((selectedString == null) !== (selectedFret == null) || (selectedString != null && (!Number.isInteger(selectedString) || !Number.isInteger(selectedFret) || selectedFret < 0 || selectedFret > 24 || (noteStemSelect.value === 'bass' ? BASS_OPEN_MIDI[selectedString] : GUITAR_OPEN_MIDI[selectedString]) + selectedFret !== midi))) {
    noteEditorStatus.textContent = 'Choose a string and fret that match the note pitch, or leave both unassigned.'; return;
  }
  Object.assign(event, {midi, note: midiToNote(midi), start: Math.round(start * 1000) / 1000, end: Math.round(end * 1000) / 1000, frequency_hz: Math.round(noteFrequency(midi) * 100) / 100, string: selectedString, fret: selectedFret, edited: true});
  currentPitchAnalysis.events.sort((a, b) => a.start - b.start);
  selectedNoteEventIndex = currentPitchAnalysis.events.indexOf(event);
  markArrangementDraft('Note updated. Save the arrangement to keep this change.');
  fillNoteEditor(); updateCurrentNote(true);
});
addNoteEventButton.addEventListener('click', () => {
  if (!currentPitchAnalysis) { noteEditorStatus.textContent = 'Wait for note analysis to finish first.'; return; }
  const start = Math.max(0, Number(audioPlayer.currentTime) || 0);
  const duration = Number(currentPitchAnalysis.duration || audioPlayer.duration || start + 0.2);
  const end = Math.min(duration, start + 0.2);
  if (end <= start) { noteEditorStatus.textContent = 'Move playback away from the end of the song to add a note.'; return; }
  const midi = parseNotePitch(editNotePitch.value) ?? 36;
  const position = getInstrumentPosition(midi);
  const event = {start: Math.round(start * 1000) / 1000, end: Math.round(end * 1000) / 1000, midi, note: midiToNote(midi), frequency_hz: Math.round(noteFrequency(midi) * 100) / 100, confidence: 1, string: position?.string ?? null, fret: position?.fret ?? null, edited: true};
  currentPitchAnalysis.events.push(event); currentPitchAnalysis.events.sort((a, b) => a.start - b.start);
  selectedNoteEventIndex = currentPitchAnalysis.events.indexOf(event);
  markArrangementDraft('Note added. Adjust its pitch and timing, then save the arrangement.');
  fillNoteEditor(); updateCurrentNote(true);
});
document.querySelector('#add-chord-tone').addEventListener('click', () => {
  if (!currentPitchAnalysis) { noteEditorStatus.textContent = 'Wait for note analysis to finish first.'; return; }
  const selected = currentPitchAnalysis.events[selectedNoteEventIndex];
  const start = selected ? Number(selected.start) : Math.max(0, Number(audioPlayer.currentTime) || 0);
  const duration = Number(currentPitchAnalysis.duration || audioPlayer.duration || start + 0.2);
  const end = Math.min(duration, selected ? Number(selected.end) : start + 0.2);
  if (end <= start) { noteEditorStatus.textContent = 'Move playback away from the end of the song to add a chord tone.'; return; }
  const midi = selected ? Math.min(96, Number(selected.midi) + 4) : (parseNotePitch(editNotePitch.value) ?? 48);
  const position = getInstrumentPosition(midi);
  const event = {start:Math.round(start*1000)/1000, end:Math.round(end*1000)/1000, midi, note:midiToNote(midi), frequency_hz:Math.round(noteFrequency(midi)*100)/100, confidence:1, string:position?.string ?? null, fret:position?.fret ?? null, edited:true, chord_tone:true};
  currentPitchAnalysis.events.push(event); currentPitchAnalysis.events.sort((a,b)=>a.start-b.start);
  selectedNoteEventIndex=currentPitchAnalysis.events.indexOf(event);
  markArrangementDraft('Chord tone added at the selected note’s timing. Set its pitch/string/fret, then save.');
  fillNoteEditor(); updateCurrentNote(true);
});

deleteNoteEventButton.addEventListener('click', () => {
  if (!currentPitchAnalysis?.events?.[selectedNoteEventIndex]) return;
  currentPitchAnalysis.events.splice(selectedNoteEventIndex, 1);
  selectedNoteEventIndex = -1; markArrangementDraft('Note deleted. Save the arrangement to keep this change.');
  fillNoteEditor(); updateCurrentNote(true);
});
saveNoteArrangementButton.addEventListener('click', async () => {
  if (!currentJobId || !currentPitchAnalysis) return;
  saveNoteArrangementButton.disabled = true;
  try {
    const response = await fetch(`/api/jobs/${currentJobId}/arrangements/${noteStemSelect.value}`, {
      method: 'PUT', headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({events: currentPitchAnalysis.events})
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.detail || 'Could not save arrangement.');
    noteAnalysisCache.delete(noteCacheKey(currentJobId, noteStemSelect.value));
    currentPitchAnalysis.events = result.events; currentPitchAnalysis.arrangement_events = result.events;
    arrangementDirty = false; saveNoteArrangementButton.textContent = 'Save arrangement';
    noteEditorStatus.textContent = result.message || 'Arrangement saved with this track.';
    setNoteEditorVisible(false);
    selectedNoteEventIndex = Math.min(selectedNoteEventIndex, currentPitchAnalysis.events.length - 1);
    fillNoteEditor(); updateCurrentNote(true);
  } catch (error) { noteEditorStatus.textContent = `Could not save arrangement: ${error.message}`; }
  finally { saveNoteArrangementButton.disabled = false; }
});

function updateCurrentNote(forceRender = false) {
  const events = currentPitchAnalysis?.events || [];
  const time = audioPlayer.currentTime || 0;
  const index = events.findIndex(event => event.start <= time && event.end > time);
  if (index >= 0) {
    const event = events[index];
    currentNoteName.textContent = event.note;
    currentNoteLabel.textContent = `${event.note} · ${event.frequency_hz != null ? `${event.frequency_hz.toFixed(1)} Hz · ` : ''}${Math.round(event.confidence * 100)}% confidence`;
    currentNoteTime.textContent = `${formatNoteTime(event.start)}–${formatNoteTime(event.end)}`;
  } else {
    currentNoteName.textContent = '—';
    currentNoteLabel.textContent = 'No detected note at this position';
    const next = events.find(event => event.start > time);
    currentNoteTime.textContent = next ? `Next: ${next.note} at ${formatNoteTime(next.start)}` : 'No later detected notes';
  }
  if (forceRender || index !== activeNoteEventIndex) {
    activeNoteEventIndex = index;
    renderNoteEvents();
  }
}
function applyPitchAnalysis(data, stemName) {
  data.suggested_events = data.events.map(event => ({...event}));
  data.events = (Array.isArray(data.arrangement_events) ? data.arrangement_events : data.events).map(event => ({...event}));
  currentPitchAnalysis = data; selectedNoteEventIndex = -1; arrangementDirty = false;
  saveNoteArrangementButton.textContent = 'Save arrangement';
  noteEditorStatus.textContent = Array.isArray(data.arrangement_events) ? 'Your saved arrangement is loaded. Automatic suggestions remain unchanged.' : 'Edit the suggestions as needed, then save your arrangement.';
  fillNoteEditor();
  noteAnalysisStatus.textContent = `${data.events.length} ${Array.isArray(data.arrangement_events) ? 'arrangement notes' : 'note suggestions'} available for ${formatNoteTime(data.duration)}.${data.truncated ? ' Analysis is limited to the first 15 minutes.' : ''} These are estimates, not verified notation.`;
  analyzeNotesButton.disabled = false; analyzeNotesButton.textContent = 'Re-analyze notes';
  updateCurrentNote(true);
}
// Completed note analyses, keyed by track and stem. Switching instrument is then
// instant and needs no network request, which matters on phones/tablets where
// the browser's per-host connection limit can be used up by audio downloads.
const noteAnalysisCache = new Map();
function noteCacheKey(jobId, stemName) { return `${jobId}:${stemName}`; }
function prefetchPitchAnalysis(jobId, stemName) {
  const key = noteCacheKey(jobId, stemName);
  if (noteAnalysisCache.has(key)) return Promise.resolve();
  return fetch(`/api/jobs/${jobId}/notes/${stemName}`, {cache: 'no-store'})
    .then(response => response.ok ? response.json() : null)
    .then(data => { if (data && Array.isArray(data.events)) noteAnalysisCache.set(key, data); })
    .catch(() => {});
}
// Stem <audio> elements start with preload="none" so six large WAV downloads
// cannot occupy every connection before the note requests are sent.
function releaseStemPreload(jobId) {
  if (currentJobId !== jobId) return;
  for (const player of stemPlayers.values()) if (player.audio.preload !== 'auto') player.audio.preload = 'auto';
}
async function loadPitchAnalysis(stemName, poll = true) {
  const requestToken = ++noteAnalysisRequestToken;
  if (noteAnalysisPollTimer) { clearTimeout(noteAnalysisPollTimer); noteAnalysisPollTimer = null; }
  if (noteAnalysisAbortController) { noteAnalysisAbortController.abort(); noteAnalysisAbortController = null; }
  if (!currentJobId || !currentStems[stemName]) {
    currentPitchAnalysis = null; activeNoteEventIndex = -2; updateCurrentNote(true);
    noteAnalysisStatus.textContent = `This track has no ${stemName} stem. Choose another instrument or use the 6-stem separation model.`;
    analyzeNotesButton.disabled = true; analyzeNotesButton.textContent = 'Analyze notes'; return;
  }
  const cacheKey = noteCacheKey(currentJobId, stemName);
  const cached = noteAnalysisCache.get(cacheKey);
  if (cached) {
    currentPitchAnalysis = null; activeNoteEventIndex = -2;
    applyPitchAnalysis(JSON.parse(JSON.stringify(cached)), stemName);
    return;
  }
  const controller = new AbortController();
  noteAnalysisAbortController = controller;
  // Mobile devices may take longer to transfer a large note-event payload over Wi-Fi.
  const requestTimeout = setTimeout(() => controller.abort(), 60000);
  analyzeNotesButton.disabled = false; analyzeNotesButton.textContent = 'Re-analyze notes';
  noteAnalysisStatus.textContent = `Requesting ${stemName} note suggestions…`;
  // Start the network request before clearing and re-rendering the note UI. On
  // mobile, rendering a large arrangement can be expensive; it must not prevent
  // the instrument change from issuing its GET request.
  let responsePromise;
  try {
    responsePromise = fetch(`/api/jobs/${currentJobId}/notes/${stemName}`, {cache: 'no-store', signal: controller.signal});
  } catch (error) {
    clearTimeout(requestTimeout);
    noteAnalysisStatus.textContent = `Could not start note request: ${error.message}`;
    return;
  }
  currentPitchAnalysis = null; activeNoteEventIndex = -2; updateCurrentNote(true);
  noteAnalysisStatus.textContent = `Checking ${stemName} note suggestions…`;
  try {
    const response = await responsePromise;
    let data;
    try { data = await response.json(); }
    catch { throw new Error(`Server returned an unreadable response (HTTP ${response.status}).`); }
    if (requestToken !== noteAnalysisRequestToken) return;
    if (!response.ok && !(response.status === 404 && /not ready/i.test(String(data.detail || '')))) {
      throw new Error(data.detail || `Server returned HTTP ${response.status}.`);
    }
    if (response.ok && Array.isArray(data.events)) {
      noteAnalysisCache.set(cacheKey, JSON.parse(JSON.stringify(data)));
      applyPitchAnalysis(data, stemName); return;
    }
    const state = data.status || 'failed';
    noteAnalysisStatus.textContent = data.message || (state === 'pending' || state === 'running' ? `Analyzing ${stemName} notes in the background…` : `Note analysis is not ready (${state}).`);
    if (state === 'pending' || state === 'running') {
      analyzeNotesButton.disabled = true; analyzeNotesButton.textContent = 'Analyzing…';
      if (poll) noteAnalysisPollTimer = setTimeout(() => loadPitchAnalysis(stemName), 2200);
    } else {
      analyzeNotesButton.disabled = false; analyzeNotesButton.textContent = 'Retry analysis';
    }
  } catch (error) {
    if (requestToken !== noteAnalysisRequestToken) return;
    const reason = error.name === 'AbortError'
      ? 'The request timed out after 60 seconds. Check the connection to Jamloom and retry.'
      : error.message;
    noteAnalysisStatus.textContent = `Could not load note suggestions: ${reason}`;
    analyzeNotesButton.disabled = false; analyzeNotesButton.textContent = 'Retry analysis';
  } finally {
    clearTimeout(requestTimeout);
    if (noteAnalysisAbortController === controller) noteAnalysisAbortController = null;
  }
}
function handleNoteStemSelectionChange() {
  const stemName = noteStemSelect.value;
  // Do not deduplicate input/change here: some mobile browsers dispatch these
  // differently. A newer request aborts the previous one in loadPitchAnalysis.
  lastNoteStemSelectionHandled = stemName;
  const isBass = stemName === 'bass';
  const stringLabel = editNoteString.closest('label');
  if (stringLabel) stringLabel.firstChild.textContent = isBass ? 'Bass string ' : 'Guitar string ';
  const choices = isBass ? [['1','1 · high G'],['2','2 · D'],['3','3 · A'],['4','4 · low E']] : [['1','1 · high E'],['2','2 · B'],['3','3 · G'],['4','4 · D'],['5','5 · A'],['6','6 · low E']];
  editNoteString.replaceChildren(new Option('Unassigned', ''));
  choices.forEach(([value, label]) => editNoteString.add(new Option(label, value)));
  selectedNoteEventIndex = -1;
  loadPitchAnalysis(stemName);
}
// Native selects normally emit change; input is retained as a mobile fallback.
// Call directly so the GET is initiated before any potentially costly UI render.
noteStemSelect.addEventListener('input', () => { stopNoteStemAudition(); handleNoteStemSelectionChange(); });
noteStemSelect.addEventListener('change', () => { stopNoteStemAudition(); handleNoteStemSelectionChange(); });
analyzeNotesButton.addEventListener('click', async () => {
  if (!currentJobId) return;
  const stemName = noteStemSelect.value;
  analyzeNotesButton.disabled = true; noteStemSelect.disabled = true;
  noteAnalysisStatus.textContent = `Analyzing ${stemName} stem… This runs locally and may take a little while.`;
  try {
    const response = await fetch(`/api/jobs/${currentJobId}/notes/${stemName}`, {method: 'POST'});
    const result = await response.json();
    if (!response.ok) throw new Error(result.detail || 'Analysis failed.');
    noteAnalysisCache.delete(noteCacheKey(currentJobId, stemName));
    currentPitchAnalysis = result; activeNoteEventIndex = -2;
    analyzeNotesButton.textContent = 'Re-analyze notes';
    noteAnalysisStatus.textContent = `${result.events.length} note events detected in ${formatNoteTime(result.duration)}.${result.truncated ? ' Analysis is limited to the first 15 minutes.' : ''} Treat these as estimates, not verified notation.`;
    await loadPitchAnalysis(stemName, false);
  } catch (error) { noteAnalysisStatus.textContent = error.message; }
  finally { analyzeNotesButton.disabled = false; noteStemSelect.disabled = false; if (analyzeNotesButton.textContent === 'Analyzing…') analyzeNotesButton.textContent = 'Re-analyze notes'; }
});

function settingsKey(trackId) { return `jamloom.settings.${trackId}`; }
function setPracticeMode(enabled, persist = true) {
  practiceMode = Boolean(enabled);
  resultPanel.classList.toggle('practice-mode', practiceMode);
  practiceModeToggle.textContent = practiceMode ? 'Show mixer' : 'Practice mode';
  practiceModeToggle.setAttribute('aria-pressed', String(practiceMode));
  document.querySelector('#mixer-page-heading').textContent = practiceMode ? 'Practice studio' : 'Mixer';
  if (persist) { try { localStorage.setItem('jamloom.practiceMode', String(practiceMode)); } catch {} }
}
try { practiceMode = localStorage.getItem('jamloom.practiceMode') !== 'false'; } catch {}
setPracticeMode(practiceMode, false);
practiceModeToggle.addEventListener('click', () => setPracticeMode(!practiceMode));
function saveTrackSettings() {
  if (!currentJobId) return;
  const stems = {};
  for (const [name, player] of stemPlayers) stems[name] = {level: Number(player.slider.value), muted: player.userMuted};
  const settings = {
    masterVolume: Number(masterVolume.value), speed: audioPlayer.playbackRate || 1,
    loopStart, loopEnd, loopEnabled, stems,
    metronomeBpm: Number(metronomeBpmInput?.value || 120),
    metronomeLevel: Number(metronomeLevelInput?.value || 60), metronomeMuted,
    metronomeDownbeatOffset,
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
  if (Number.isFinite(settings.metronomeDownbeatOffset) && settings.metronomeDownbeatOffset >= 0) metronomeDownbeatOffset = settings.metronomeDownbeatOffset;
  else metronomeDownbeatOffset = 0;
  updateLoopUI(); updateStemAudioLevels(); resetMetronomeGrid(); saveTrackSettings();
}
function formatLibrarySize(bytes) {
  const size = Math.max(0, Number(bytes) || 0);
  if (size < 1024) return `${size} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let value = size / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) { value /= 1024; unit++; }
  return `${value.toLocaleString(undefined, {maximumFractionDigits: value >= 100 ? 0 : 1})} ${units[unit]}`;
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
    if (sort === 'storage') return Number(b.storage_bytes || 0) - Number(a.storage_bytes || 0);
    return String(b.created_at || '').localeCompare(String(a.created_at || ''));
  });
  libraryList.replaceChildren();
  libraryShowMore.hidden = true;
  if (!libraryTracks.length) { libraryStatus.textContent = 'Your library is empty. Create a backing track to get started.'; return; }
  const searching = query.length > 0;
  const visibleTracks = searching ? tracks : tracks.slice(0, libraryVisibleLimit);
  if (searching) {
    libraryStatus.textContent = `${tracks.length} matching song${tracks.length === 1 ? '' : 's'} · available to everyone using this Jamloom instance.`;
  } else if (tracks.length > visibleTracks.length) {
    libraryStatus.textContent = `Showing ${visibleTracks.length} of ${tracks.length} songs. Search to find any song, or show more below.`;
    libraryShowMore.hidden = false;
    libraryShowMore.textContent = `Show 5 more songs (${tracks.length - visibleTracks.length} remaining)`;
  } else {
    libraryStatus.textContent = `${tracks.length} song${tracks.length === 1 ? '' : 's'} in your library · available to everyone using this Jamloom instance.`;
  }
  if (!tracks.length) { const empty = document.createElement('p'); empty.className = 'library-no-results'; empty.textContent = 'No songs match that search.'; libraryList.append(empty); return; }
  for (const track of visibleTracks) {
    const row = document.createElement('article'); row.className = 'library-item';
    const details = document.createElement('div'); details.className = 'library-item-details';
    const title = document.createElement('strong'); title.textContent = track.title || (track.filename || 'Untitled track').replace(/\.[^.]+$/, '');
    const artist = document.createElement('span'); artist.className = 'library-artist'; artist.textContent = [track.artist, track.album].filter(Boolean).join(' · ') || 'Artist and album not set';
    const meta = document.createElement('span');
    const date = track.created_at ? new Date(track.created_at).toLocaleDateString() : 'Saved';
    const model = track.model === 'htdemucs_6s' ? '6 stems' : '4 stems';
    const musicInfo = [track.bpm ? `${Number(track.bpm)} BPM` : '', track.time_signature || ''].filter(Boolean).join(' · ');
    meta.textContent = [formatLibraryDuration(track.duration), model, formatLibrarySize(track.storage_bytes), musicInfo, date].filter(Boolean).join(' · ');
    details.append(title, artist, meta);
    const actions = document.createElement('div'); actions.className = 'library-item-actions';
    const open = document.createElement('button'); open.type = 'button'; open.className = 'button secondary'; open.textContent = 'Open';
    open.addEventListener('click', () => loadLibraryTrack(track.id));
    const edit = document.createElement('button'); edit.type = 'button'; edit.className = 'button ghost'; edit.textContent = 'Edit details';
    edit.addEventListener('click', () => {
      editingLibraryTrack = track;
      document.querySelector('#edit-track-title').value = track.title || (track.filename || '').replace(/\.[^.]+$/, '');
      document.querySelector('#edit-track-artist').value = track.artist || '';
      document.querySelector('#edit-track-album').value = track.album || '';
      document.querySelector('#edit-track-bpm').value = track.bpm == null ? '' : String(track.bpm);
      document.querySelector('#edit-track-signature').value = track.time_signature || '';
      editTrackStatus.textContent = '';
      editTrackDialog.showModal();
      document.querySelector('#edit-track-title').focus();
    });
    const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'button ghost library-delete'; remove.textContent = 'Delete';
    remove.addEventListener('click', async () => {
      if (!window.confirm(`Delete “${track.title || track.filename || 'this track'}” and its separated audio (${formatLibrarySize(track.storage_bytes)}) from the shared library? This cannot be undone.`)) return;
      remove.disabled = true;
      try { const res = await fetch(`/api/library/${encodeURIComponent(track.id)}`, {method:'DELETE'}); const result = await res.json(); if (!res.ok) throw new Error(result.detail || 'Delete failed.');
        if (currentJobId === track.id) { audioPlayer.pause(); stopMetronome(); stopStemPlayers(); playerArea.hidden = true; mixerEmptyState.hidden = false; currentJobId = null; updateBrowserTitle(); }
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
    libraryStorageSummary.textContent = `Library storage: ${formatLibrarySize(data.total_storage_bytes)} across ${data.count || 0} song${data.count === 1 ? '' : 's'}. Sizes include originals, separated stems, backing mixes and saved note data.`;
    renderLibrary();
  } catch (err) { libraryStatus.textContent = `Library could not be loaded: ${err.message}`; }
}
function closeEditTrackDialog() {
  if (editTrackDialog.open) editTrackDialog.close();
  editingLibraryTrack = null;
}
document.querySelector('#close-edit-track').addEventListener('click', closeEditTrackDialog);
document.querySelector('#cancel-edit-track').addEventListener('click', closeEditTrackDialog);
editTrackDialog.addEventListener('click', event => { if (event.target === editTrackDialog) closeEditTrackDialog(); });
function updateLoadedTrackHeading(track) {
  const title = track.title || (track.filename || 'Backing track').replace(/\.[^.]+$/, '');
  document.querySelector('#result-filename').textContent = title;
  const metadata = [];
  if (track.artist) metadata.push(track.artist);
  if (track.album) metadata.push(track.album);
  if (track.bpm != null && track.bpm !== '') metadata.push(`${track.bpm} BPM`);
  if (track.time_signature) metadata.push(track.time_signature);
  const duration = Number(track.duration);
  if (Number.isFinite(duration) && duration > 0) metadata.push(formatTime(duration));
  if (!metadata.length) metadata.push('Mixed backing track');
  document.querySelector('#result-metadata').textContent = metadata.join(' · ');
  updateBrowserTitle();
}

function updateBrowserTitle(status = audioPlayer.paused ? 'Paused' : 'Playing') {
  if (!currentJobId || playerArea.hidden) {
    document.title = 'Jamloom — play your part';
    return;
  }
  const title = document.querySelector('#result-filename').textContent || 'Backing track';
  const icon = status === 'Playing' ? '▶' : status === 'Ended' ? '■' : '⏸';
  document.title = `${icon} ${title} — ${status} | Jamloom`;
}

editTrackForm.addEventListener('submit', async event => {
  event.preventDefault();
  if (!editingLibraryTrack) return;
  const title = document.querySelector('#edit-track-title').value.trim();
  const artist = document.querySelector('#edit-track-artist').value.trim();
  const album = document.querySelector('#edit-track-album').value.trim();
  const bpmText = document.querySelector('#edit-track-bpm').value.trim();
  const bpm = bpmText === '' ? null : Number(bpmText);
  const signature = document.querySelector('#edit-track-signature').value.trim();
  if (!title) { editTrackStatus.textContent = 'Please enter a title.'; return; }
  if (bpm !== null && (!Number.isFinite(bpm) || bpm < 1 || bpm > 400)) { editTrackStatus.textContent = 'BPM must be between 1 and 400, or left empty.'; return; }
  if (signature && !/^(?:[1-9]|1[0-6])\s*\/\s*(?:1|2|4|8|16)$/.test(signature)) { editTrackStatus.textContent = 'Use a time signature such as 4/4, 3/4 or 6/8 (numerator 1–16; denominator 1, 2, 4, 8 or 16).'; return; }
  const saveButton = document.querySelector('#save-edit-track');
  saveButton.disabled = true;
  editTrackStatus.textContent = 'Saving…';
  try {
    const res = await fetch(`/api/library/${encodeURIComponent(editingLibraryTrack.id)}`, {method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify({title, artist, album, bpm, time_signature:signature})});
    const result = await res.json();
    if (!res.ok) throw new Error(result.detail || 'Could not update track details.');
    const trackId = editingLibraryTrack.id;
    closeEditTrackDialog();
    await loadLibrary();
    if (currentJobId === trackId) updateLoadedTrackHeading(result.track);
  } catch (err) {
    editTrackStatus.textContent = err.message;
  } finally { saveButton.disabled = false; }
});

librarySearch.addEventListener('input', () => { libraryVisibleLimit = LIBRARY_PAGE_SIZE; renderLibrary(); });
librarySort.addEventListener('change', () => { libraryVisibleLimit = LIBRARY_PAGE_SIZE; renderLibrary(); });
libraryShowMore.addEventListener('click', () => { libraryVisibleLimit += LIBRARY_PAGE_SIZE; renderLibrary(); });
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
// In stem-mixer mode the main <audio> element is only a clock for the slider,
// time display, loop, and note/fretboard highlighting. Playing the real backing
// mix there means a seventh large network stream: on phones it stalls, the UI
// freezes while the stems keep playing, and stem drift-correction then seeks the
// stems back. Instead the clock plays a locally generated silent WAV (no network).
let currentBackingUrl = '';
let currentTrackDuration = 0;
let silentClockUrl = null;
let silentClockSeconds = 0;
let clockKind = '';
function buildSilentClockUrl(seconds) {
  const rate = 8000;
  const samples = Math.max(rate, Math.round(seconds * rate));
  const bytes = new Uint8Array(44 + samples);
  const view = new DataView(bytes.buffer);
  const text = (offset, value) => { for (let i = 0; i < value.length; i++) bytes[offset + i] = value.charCodeAt(i); };
  text(0, 'RIFF'); view.setUint32(4, 36 + samples, true); text(8, 'WAVE'); text(12, 'fmt ');
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
  view.setUint32(24, rate, true); view.setUint32(28, rate, true); view.setUint16(32, 1, true); view.setUint16(34, 8, true);
  text(36, 'data'); view.setUint32(40, samples, true);
  bytes.fill(0x80, 44); // unsigned 8-bit PCM silence
  return URL.createObjectURL(new Blob([bytes], {type: 'audio/wav'}));
}
function setClockSource(wantSilent, reset = false) {
  const silent = Boolean(wantSilent) && currentTrackDuration > 0;
  const kind = silent ? 'silent' : 'backing';
  if (!reset && clockKind === kind && audioPlayer.getAttribute('src')) return;
  const time = reset ? 0 : (audioPlayer.currentTime || 0);
  const wasPlaying = !reset && !audioPlayer.paused;
  const rate = reset ? 1 : audioPlayer.playbackRate;
  clockKind = kind;
  if (silent) {
    if (!silentClockUrl || Math.abs(silentClockSeconds - currentTrackDuration) > 0.0005) {
      if (silentClockUrl) URL.revokeObjectURL(silentClockUrl);
      silentClockUrl = buildSilentClockUrl(currentTrackDuration); silentClockSeconds = currentTrackDuration;
    }
    audioPlayer.src = silentClockUrl;
  } else {
    audioPlayer.src = currentBackingUrl;
  }
  audioPlayer.playbackRate = rate; setPitchPreservation(audioPlayer);
  if (time > 0 || wasPlaying) {
    audioPlayer.addEventListener('loadedmetadata', () => {
      try { audioPlayer.currentTime = time; } catch {}
      audioPlayer.playbackRate = rate;
      if (wasPlaying) audioPlayer.play().catch(() => {});
    }, {once: true});
  }
}
// Paused stems keep downloading in the background. On HTTP/1.1 that can occupy
// every browser connection and leave the backing-mix request queued forever, so
// stems drop their network connection while the backing mix is in use.
function releaseStemNetwork() {
  for (const player of stemPlayers.values()) {
    player.audio.pause();
    const src = player.audio.getAttribute('src');
    if (src) { player.savedSrc = src; player.audio.removeAttribute('src'); player.audio.load(); }
  }
}
function restoreStemNetwork() {
  for (const player of stemPlayers.values()) {
    if (!player.audio.getAttribute('src') && player.savedSrc) { player.audio.preload = 'auto'; player.audio.src = player.savedSrc; }
  }
}
function setMixerMode(enabled) {
  mixerMode = enabled;
  if (enabled) restoreStemNetwork(); else releaseStemNetwork();
  setClockSource(enabled && stemPlayers.size > 0);
  audioPlayer.muted = enabled && clockKind === 'backing';
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
    const audio = document.createElement('audio'); audio.preload = 'none'; audio.src = url; audio.loop = false;
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
  bpmInput.step = '0.1';
  bpmInput.value = currentTrackBpm && currentTrackBpm >= 30 && currentTrackBpm <= 300 ? String(currentTrackBpm) : '120';
  bpmInput.setAttribute('aria-label', 'Metronome pulse rate in beats per minute at normal playback speed');
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
  const sync = document.createElement('button');
  sync.id = 'metronome-sync'; sync.type = 'button'; sync.className = 'button secondary metronome-sync'; sync.textContent = 'Set downbeat'; sync.title = 'Set beat 1 at the current playback position';
  const resetCycle = document.createElement('button');
  resetCycle.id = 'metronome-reset-cycle'; resetCycle.type = 'button'; resetCycle.className = 'button ghost metronome-reset-cycle'; resetCycle.textContent = 'Reset cycle'; resetCycle.title = 'Make the next metronome pulse beat 1';
  const solo = document.createElement('button');
  solo.id = 'metronome-solo'; solo.type = 'button'; solo.className = 'button ghost stem-solo'; solo.textContent = 'Solo'; solo.setAttribute('aria-pressed', 'false');
  controls.append(bpmLabel, volumeLabel, sync, resetCycle, mute, solo);
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
  sync.addEventListener('click', () => {
    metronomeDownbeatOffset = Math.max(0, audioPlayer.currentTime || 0);
    resetMetronomeGrid();
    if (metronomeMessage) metronomeMessage.textContent = `Downbeat set at ${formatTime(metronomeDownbeatOffset)}. This alignment is saved for this song in this browser.`;
    saveTrackSettings();
  });
  resetCycle.addEventListener('click', () => {
    const bpm = Number(metronomeBpmInput?.value || 120);
    const beatSeconds = 60 / bpm;
    const mediaTime = Math.max(0, audioPlayer.currentTime || 0);
    const relative = Math.max(0, mediaTime - metronomeDownbeatOffset);
    const nextPulse = metronomeDownbeatOffset + Math.ceil((relative + 0.001) / beatSeconds) * beatSeconds;
    metronomeDownbeatOffset = Math.max(0, nextPulse);
    resetMetronomeGrid();
    if (metronomeMessage) metronomeMessage.textContent = `Bar cycle reset: the next pulse is beat 1. Alignment saved for this song in this browser.`;
    saveTrackSettings();
  });
  mute.addEventListener('click', () => { metronomeMuted = !metronomeMuted; updateStemAudioLevels(); saveTrackSettings(); });
  solo.addEventListener('click', () => { soloedStem = soloedStem === '__metronome' ? null : '__metronome'; updateStemAudioLevels(); saveTrackSettings(); });
  updateMetronomeBpmDisplay();
  updateMetronomeMeterMessage();
}

function updateMetronomeMeterMessage() {
  if (!metronomeMessage) return;
  const meter = parseTimeSignature(currentTrackTimeSignature);
  if (!meter) {
    metronomeMessage.textContent = 'No time signature set; the metronome uses a 4/4 accent pattern. Set BPM manually, or add track metadata in the library. Timing follows playback speed.';
  } else if (meter.compound) {
    metronomeMessage.textContent = `${currentTrackTimeSignature}: clicks mark dotted-quarter pulses, grouped ${meter.pulses} per bar, with a strong first pulse and a lighter secondary accent where appropriate. BPM means dotted-quarter pulses per minute; timing follows playback speed.`;
  } else {
    metronomeMessage.textContent = `${currentTrackTimeSignature}: the first beat is accented${meter.numerator === 4 && meter.denominator === 4 ? ', with a lighter accent on beat 3' : ''}. BPM is the metronome beat rate; timing follows playback speed.`;
  }
}

function parseTimeSignature(signature) {
  const match = String(signature || '').trim().match(/^(\d{1,2})\s*\/\s*(1|2|4|8|16)$/);
  if (!match) return null;
  const numerator = Number(match[1]);
  const denominator = Number(match[2]);
  if (numerator < 1 || numerator > 16) return null;
  const compound = denominator === 8 && numerator >= 6 && numerator % 3 === 0;
  return { numerator, denominator, compound, pulses: compound ? numerator / 3 : numerator };
}

function getBeatAccent(beatIndex) {
  const meter = parseTimeSignature(currentTrackTimeSignature) || {numerator: 4, denominator: 4, compound: false, pulses: 4};
  const beatInBar = ((beatIndex % meter.pulses) + meter.pulses) % meter.pulses;
  if (beatInBar === 0) return 'strong';
  if (meter.compound && (meter.pulses === 2 ? beatInBar === 1 : meter.pulses === 4 ? beatInBar === 2 : beatInBar > 0)) return 'medium';
  if (!meter.compound && meter.numerator === 4 && meter.denominator === 4 && beatInBar === 2) return 'medium';
  return 'normal';
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
  if (!Number.isFinite(bpm) || bpm <= 0) {
    nextBeatAudioTime = null;
    nextBeatIndex = 0;
    return;
  }
  const beatSeconds = 60 / bpm;
  const mediaTime = audioPlayer.currentTime || 0;
  const relativeTime = mediaTime - metronomeDownbeatOffset;
  const nearestRelativeBeat = Math.round(relativeTime / beatSeconds) * beatSeconds;
  let targetMediaTime;
  if (relativeTime < 0) {
    targetMediaTime = metronomeDownbeatOffset;
  } else {
    const targetRelativeBeat = Math.abs(relativeTime - nearestRelativeBeat) < 0.08
      ? nearestRelativeBeat
      : Math.ceil(relativeTime / beatSeconds) * beatSeconds;
    targetMediaTime = metronomeDownbeatOffset + targetRelativeBeat;
  }
  nextBeatIndex = Math.max(0, Math.round((targetMediaTime - metronomeDownbeatOffset) / beatSeconds));
  // Use the Web Audio clock for scheduling. The media clock is only used to
  // align the grid when starting, changing tempo, seeking, or changing speed.
  nextBeatAudioTime = audioContext
    ? audioContext.currentTime + Math.max(0, targetMediaTime - mediaTime) / (audioPlayer.playbackRate || 1)
    : null;
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
  const accent = getBeatAccent(beatIndex);
  const frequency = accent === 'strong' ? 1320 : accent === 'medium' ? 1050 : 880;
  const strength = accent === 'strong' ? 0.42 : accent === 'medium' ? 0.34 : 0.28;
  oscillator.type = 'sine';
  oscillator.frequency.setValueAtTime(frequency, when);
  gain.gain.setValueAtTime(0.0001, when);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, gainValue * strength), when + 0.003);
  gain.gain.exponentialRampToValueAtTime(0.0001, when + 0.055);
  oscillator.connect(gain); gain.connect(audioContext.destination);
  oscillator.start(when); oscillator.stop(when + 0.06);
}

function tickMetronome() {
  if (audioPlayer.paused || audioPlayer.ended || !audioContext) return;
  const bpm = Number(metronomeBpmInput?.value);
  if (!Number.isFinite(bpm) || bpm < 30 || bpm > 300) return;

  const rate = audioPlayer.playbackRate || 1;
  const beatSeconds = 60 / bpm;
  const audioNow = audioContext.currentTime;
  const beatInterval = beatSeconds / rate;
  if (nextBeatAudioTime === null) resetMetronomeGrid();
  if (nextBeatAudioTime === null) return;

  // If the browser briefly throttles this timer, discard stale beats rather
  // than trying to play a burst of old clicks when the page wakes up.
  if (nextBeatAudioTime < audioNow - beatInterval) {
    const missed = Math.floor((audioNow - nextBeatAudioTime) / beatInterval) + 1;
    nextBeatAudioTime += missed * beatInterval;
    nextBeatIndex += missed;
  }

  const horizon = audioNow + 0.12;
  while (nextBeatAudioTime <= horizon) {
    const when = Math.max(audioNow + 0.005, nextBeatAudioTime);
    scheduleMetronomeClick(when, nextBeatIndex);
    nextBeatAudioTime = when + beatInterval;
    nextBeatIndex += 1;
  }
}

async function startMetronome() {
  try {
    await ensureAudioContext();
    if (audioPlayer.paused || audioPlayer.ended) return;
    resetMetronomeGrid();
    if (metronomeTimer) clearInterval(metronomeTimer);
    tickMetronome();
    metronomeTimer = setInterval(tickMetronome, 25);
    updateMetronomeMeterMessage();
    metronomeMessage.textContent += ' Playback speed scales the effective pulse rate.';
  } catch (err) {
    metronomeMessage.textContent = err.message;
  }
}
function stopMetronome() {
  if (metronomeTimer) clearInterval(metronomeTimer);
  metronomeTimer = null;
  nextBeatAudioTime = null;
  nextBeatIndex = 0;
}

function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const whole = Math.floor(seconds);
  const hours = Math.floor(whole / 3600);
  const minutes = Math.floor((whole % 3600) / 60);
  const secs = whole % 60;
  return hours ? `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}` : `${minutes}:${String(secs).padStart(2, '0')}`;
}
let seekDragging = false;
// :active is unreliable on touch screens (it can stay set after a tap, which
// would freeze the slider), so track dragging explicitly.
['pointerdown', 'touchstart', 'mousedown'].forEach(type => playbackSeek.addEventListener(type, () => { seekDragging = true; }, {passive: true}));
['pointerup', 'pointercancel', 'touchend', 'touchcancel', 'mouseup', 'change', 'blur'].forEach(type => playbackSeek.addEventListener(type, () => { seekDragging = false; updateTimeDisplay(); }));
function updateTimeDisplay() {
  const current = Number.isFinite(audioPlayer.currentTime) ? audioPlayer.currentTime : 0;
  const duration = Number.isFinite(audioPlayer.duration) ? audioPlayer.duration : 0;
  timeDisplay.textContent = `${formatTime(current)} / ${formatTime(duration)}`;
  if (playbackSeek && !seekDragging) {
    playbackSeek.max = String(Math.max(1, Math.round(duration * 10)));
    playbackSeek.value = String(Math.round(current * 10));
  }
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
playbackSeek.addEventListener('input', () => { if (Number.isFinite(audioPlayer.duration)) audioPlayer.currentTime = Math.min(audioPlayer.duration, Number(playbackSeek.value) / 10); updateTimeDisplay(); });
beginningButton.addEventListener('click', () => { audioPlayer.currentTime = 0; updateTimeDisplay(); updateCurrentNote(true); });
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
function startNotePlaybackUpdates() {
  if (notePlaybackInterval !== null) return;
  // Use a timer rather than relying on animation frames: mobile browsers may
  // throttle requestAnimationFrame even while media audio continues playing.
  const tick = () => {
    try {
      updateTimeDisplay();
      updateCurrentNote();
      if (noteAuditionEndTime !== null && audioPlayer.currentTime >= noteAuditionEndTime) {
        noteAuditionEndTime = null;
        audioPlayer.pause();
      }
    } catch (error) {
      console.error('Playback UI update failed:', error);
    }
    if (audioPlayer.paused || audioPlayer.ended) stopNotePlaybackUpdates();
  };
  tick();
  notePlaybackInterval = setInterval(tick, 80);
}
function stopNotePlaybackUpdates() {
  if (notePlaybackInterval !== null) clearInterval(notePlaybackInterval);
  notePlaybackInterval = null;
  if (notePlaybackAnimationFrame !== null) cancelAnimationFrame(notePlaybackAnimationFrame);
  notePlaybackAnimationFrame = null;
  updateTimeDisplay();
  updateCurrentNote();
}
audioPlayer.addEventListener('play', () => {
  stopNoteStemAudition();
  requestScreenWakeLock();
  setNoteEditorVisible(false);
  playToggleButton.textContent = '⏸';
  playToggleButton.title = 'Pause';
  playToggleButton.setAttribute('aria-label', 'Pause');
  updateBrowserTitle('Playing');
  startMetronome();
  startNotePlaybackUpdates();
  if (mixerMode) playStemPlayers();
});
audioPlayer.addEventListener('pause', () => {
  noteAuditionEndTime = null;
  releaseScreenWakeLock();
  playToggleButton.textContent = '▶';
  playToggleButton.title = 'Play';
  playToggleButton.setAttribute('aria-label', 'Play');
  updateBrowserTitle('Paused');
  stopMetronome();
  stopNotePlaybackUpdates();
  for (const player of stemPlayers.values()) player.audio.pause();
});
audioPlayer.addEventListener('seeking', () => { syncStemPlayers(true); resetMetronomeGrid(); updateTimeDisplay(); });
audioPlayer.addEventListener('seeked', () => { syncStemPlayers(true); updateTimeDisplay(); updateCurrentNote(true); });
audioPlayer.addEventListener('ratechange', () => { syncStemPlayers(true); updateMetronomeBpmDisplay(); resetMetronomeGrid(); });
audioPlayer.addEventListener('timeupdate', () => {
  updateTimeDisplay();
  updateCurrentNote();
  if (loopEnabled && loopStart !== null && loopEnd !== null && audioPlayer.currentTime >= loopEnd) {
    audioPlayer.currentTime = loopStart;
  }
  syncStemPlayers(false);
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden) return;
  if (!audioPlayer.paused && !audioPlayer.ended) requestScreenWakeLock();
  updateTimeDisplay(); updateCurrentNote(true);
  if (!audioPlayer.paused && !audioPlayer.ended) startNotePlaybackUpdates();
});
audioPlayer.addEventListener('ended', () => { releaseScreenWakeLock(); stopMetronome(); stopNotePlaybackUpdates(); updateBrowserTitle('Ended'); playToggleButton.textContent = '▶';
  playToggleButton.title = 'Play';
  playToggleButton.setAttribute('aria-label', 'Play'); });
audioPlayer.addEventListener('loadedmetadata', updateTimeDisplay);
audioPlayer.addEventListener('durationchange', updateTimeDisplay);
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
  if (noteAnalysisPollTimer) { clearTimeout(noteAnalysisPollTimer); noteAnalysisPollTimer = null; }
  noteAnalysisRequestToken++;
  audioPlayer.pause(); stopMetronome(); stopStemPlayers();
  metronomeMuted = false; metronomeDownbeatOffset = 0; metronomeBpmInput = null; metronomeLevelInput = null; metronomeLevelValue = null; metronomeMuteButton = null; metronomeSoloButton = null;
  playerArea.hidden = false; mixerEmptyState.hidden = true; separatorPanel.hidden = true; jobProgress.hidden = true; currentJobId = job.id; setPracticeMode(practiceMode, false);
  updateLoadedTrackHeading(job);
  currentBackingUrl = job.backing_url; currentTrackDuration = Number(job.duration) || 0; clockKind = '';
  setClockSource(Object.keys(job.stems || {}).length > 0, true); audioPlayer.volume = masterGain(); audioPlayer.playbackRate = 1; speedSelect.value = '1';
  loopStart = null; loopEnd = null; loopEnabled = false; updateLoopUI(); updateTimeDisplay();
  currentTrackBpm = job.bpm == null ? null : Number(job.bpm);
  currentTrackTimeSignature = job.time_signature || '';
  sourceBpmInput.value = job.bpm == null ? '' : String(job.bpm);
  downloadLink.href = job.download_url; currentStems = job.stems || {};
  const noteChoices = ['bass', 'guitar'].filter(name => Boolean(currentStems[name]));
  noteStemSelect.replaceChildren();
  for (const name of noteChoices) { const option = document.createElement('option'); option.value = name; option.textContent = name[0].toUpperCase() + name.slice(1); noteStemSelect.append(option); }
  if (!noteChoices.length) { const option = document.createElement('option'); option.value = 'bass'; option.textContent = 'Bass (not available)'; noteStemSelect.append(option); }
  noteStemSelect.value = noteChoices.includes('bass') ? 'bass' : (noteChoices[0] || 'bass');
  lastNoteStemSelectionHandled = noteStemSelect.value;
  const initialIsBass = noteStemSelect.value === 'bass';
  const initialStringLabel = editNoteString.closest('label');
  if (initialStringLabel) initialStringLabel.firstChild.textContent = initialIsBass ? 'Bass string ' : 'Guitar string ';
  const initialStringChoices = initialIsBass ? [['1','1 · high G'],['2','2 · D'],['3','3 · A'],['4','4 · low E']] : [['1','1 · high E'],['2','2 · B'],['3','3 · G'],['4','4 · D'],['5','5 · A'],['6','6 · low E']];
  editNoteString.replaceChildren(new Option('Unassigned', ''));
  initialStringChoices.forEach(([value, label]) => editNoteString.add(new Option(label, value)));
  mixerModelLabel.textContent = job.model === 'htdemucs_6s' ? '6 stems · vocals, drums, bass, guitar, piano, other' : '4 stems · vocals, drums, bass, other';
  // Issue the note requests first, then let the large audio downloads start.
  const initialJobId = job.id;
  const initialNotes = loadPitchAnalysis(noteStemSelect.value);
  const otherNotes = noteChoices.filter(name => name !== noteStemSelect.value).map(name => prefetchPitchAnalysis(initialJobId, name));
  renderStems(currentStems);
  Promise.race([Promise.allSettled([initialNotes, ...otherNotes]), new Promise(resolve => setTimeout(resolve, 10000))])
    .then(() => releaseStemPreload(initialJobId));
  loadMusicXml();
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
  separatorPanel.hidden = false; errorBox.hidden = true; jobProgress.hidden = false; mixerEmptyState.hidden = false; playerArea.hidden = true; currentJobId = null; updateBrowserTitle();
  audioPlayer.pause(); stopMetronome(); audioPlayer.muted = false; clockKind = ''; audioPlayer.removeAttribute('src'); audioPlayer.load();
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
