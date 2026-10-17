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
const noteStemSelect = document.querySelector('#note-stem-select');
const analyzeNotesButton = document.querySelector('#analyze-notes-button');
const noteAnalysisStatus = document.querySelector('#note-analysis-status');
const currentNoteName = document.querySelector('#current-note-name');
const currentNoteLabel = document.querySelector('#current-note-label');
const currentNoteTime = document.querySelector('#current-note-time');
const noteEventsContainer = document.querySelector('#note-events');
const editNotePitch = document.querySelector('#edit-note-pitch');
const editNoteStart = document.querySelector('#edit-note-start');
const editNoteEnd = document.querySelector('#edit-note-end');
const applyNoteEditButton = document.querySelector('#apply-note-edit');
const addNoteEventButton = document.querySelector('#add-note-event');
const deleteNoteEventButton = document.querySelector('#delete-note-event');
const saveNoteArrangementButton = document.querySelector('#save-note-arrangement');
const noteEditorStatus = document.querySelector('#note-editor-status');

function formatNoteTime(seconds) { return formatTime(seconds); }
function renderNoteEvents() {
  if (!currentPitchAnalysis?.events?.length) {
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
  const start = Math.max(0, index - 3);
  const visible = events.slice(start, start + 10);
  noteEventsContainer.replaceChildren();
  visible.forEach((event, offset) => {
    const eventIndex = start + offset;
    const button = document.createElement('button'); button.type = 'button'; button.className = 'note-event';
    if (eventIndex === activeNoteEventIndex) button.classList.add('active');
    if (eventIndex === selectedNoteEventIndex) button.classList.add('selected');
    const note = document.createElement('strong'); note.textContent = event.note;
    const frequency = document.createElement('span'); frequency.className = 'note-event-frequency'; frequency.textContent = event.frequency_hz != null ? `${event.frequency_hz.toFixed(1)} Hz` : '';
    const timestamp = document.createElement('span'); timestamp.textContent = formatNoteTime(event.start);
    button.append(note, frequency, timestamp);
    button.addEventListener('click', () => { selectedNoteEventIndex = eventIndex; audioPlayer.currentTime = event.start; fillNoteEditor(); updateCurrentNote(true); });
    noteEventsContainer.append(button);
  });
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
  applyNoteEditButton.disabled = !enabled; deleteNoteEventButton.disabled = !enabled;
  if (!event) return;
  editNotePitch.value = event.note || midiToNote(event.midi);
  editNoteStart.value = Number(event.start).toFixed(2);
  editNoteEnd.value = Number(event.end).toFixed(2);
}
function markArrangementDraft(message = 'Unsaved changes. Save the arrangement to keep them with this track.') {
  arrangementDirty = true;
  noteEditorStatus.textContent = message;
  saveNoteArrangementButton.textContent = 'Save arrangement *';
}
function noteFrequency(midi) { return 440 * (2 ** ((midi - 69) / 12)); }
applyNoteEditButton.addEventListener('click', () => {
  const event = currentPitchAnalysis?.events?.[selectedNoteEventIndex];
  if (!event) return;
  const midi = parseNotePitch(editNotePitch.value);
  const start = Number(editNoteStart.value), end = Number(editNoteEnd.value);
  if (midi === null) { noteEditorStatus.textContent = 'Enter a pitch such as A1, C#2 or Bb2.'; return; }
  if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end <= start || end > Number(currentPitchAnalysis.duration || audioPlayer.duration || Infinity)) {
    noteEditorStatus.textContent = 'Check the timing: start must be before end and both must be within the song.'; return;
  }
  Object.assign(event, {midi, note: midiToNote(midi), start: Math.round(start * 1000) / 1000, end: Math.round(end * 1000) / 1000, frequency_hz: Math.round(noteFrequency(midi) * 100) / 100, edited: true});
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
  const event = {start: Math.round(start * 1000) / 1000, end: Math.round(end * 1000) / 1000, midi, note: midiToNote(midi), frequency_hz: Math.round(noteFrequency(midi) * 100) / 100, confidence: 1, edited: true};
  currentPitchAnalysis.events.push(event); currentPitchAnalysis.events.sort((a, b) => a.start - b.start);
  selectedNoteEventIndex = currentPitchAnalysis.events.indexOf(event);
  markArrangementDraft('Note added. Adjust its pitch and timing, then save the arrangement.');
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
    currentPitchAnalysis.events = result.events; currentPitchAnalysis.arrangement_events = result.events;
    arrangementDirty = false; saveNoteArrangementButton.textContent = 'Save arrangement';
    noteEditorStatus.textContent = result.message || 'Arrangement saved with this track.';
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
async function loadPitchAnalysis(stemName, poll = true) {
  const requestToken = ++noteAnalysisRequestToken;
  if (noteAnalysisPollTimer) { clearTimeout(noteAnalysisPollTimer); noteAnalysisPollTimer = null; }
  currentPitchAnalysis = null; activeNoteEventIndex = -2; updateCurrentNote(true);
  if (!currentJobId || !currentStems[stemName]) {
    noteAnalysisStatus.textContent = `This track has no ${stemName} stem. Choose another instrument or use the 6-stem separation model.`;
    analyzeNotesButton.disabled = true; analyzeNotesButton.textContent = 'Analyze notes'; return;
  }
  analyzeNotesButton.disabled = false; analyzeNotesButton.textContent = 'Re-analyze notes';
  noteAnalysisStatus.textContent = `Checking ${stemName} note suggestions…`;
  try {
    const response = await fetch(`/api/jobs/${currentJobId}/notes/${stemName}`);
    const data = await response.json();
    if (requestToken !== noteAnalysisRequestToken) return;
    if (response.ok && Array.isArray(data.events)) {
      data.suggested_events = data.events.map(event => ({...event}));
      data.events = (Array.isArray(data.arrangement_events) ? data.arrangement_events : data.events).map(event => ({...event}));
      currentPitchAnalysis = data; selectedNoteEventIndex = -1; arrangementDirty = false;
      saveNoteArrangementButton.textContent = 'Save arrangement';
      noteEditorStatus.textContent = Array.isArray(data.arrangement_events) ? 'Your saved arrangement is loaded. Automatic suggestions remain unchanged.' : 'Edit the suggestions as needed, then save your arrangement.';
      fillNoteEditor();
      noteAnalysisStatus.textContent = `${data.events.length} ${Array.isArray(data.arrangement_events) ? 'arrangement notes' : 'note suggestions'} available for ${formatNoteTime(data.duration)}.${data.truncated ? ' Analysis is limited to the first 15 minutes.' : ''} These are estimates, not verified notation.`;
      analyzeNotesButton.disabled = false; analyzeNotesButton.textContent = 'Re-analyze notes';
      updateCurrentNote(true); return;
    }
    const state = data.status || (response.status === 404 ? 'pending' : 'failed');
    noteAnalysisStatus.textContent = data.message || (state === 'pending' || state === 'running' ? `Analyzing ${stemName} notes in the background…` : `Note analysis is not ready (${state}).`);
    if (state === 'pending' || state === 'running') {
      analyzeNotesButton.disabled = true; analyzeNotesButton.textContent = 'Analyzing…';
      if (poll) noteAnalysisPollTimer = setTimeout(() => loadPitchAnalysis(stemName), 2200);
    } else {
      analyzeNotesButton.disabled = false; analyzeNotesButton.textContent = 'Retry analysis';
    }
  } catch (error) {
    if (requestToken !== noteAnalysisRequestToken) return;
    noteAnalysisStatus.textContent = `Could not load note suggestions: ${error.message}`;
    analyzeNotesButton.disabled = false; analyzeNotesButton.textContent = 'Retry analysis';
  }
}
noteStemSelect.addEventListener('change', () => { selectedNoteEventIndex = -1; loadPitchAnalysis(noteStemSelect.value); });
analyzeNotesButton.addEventListener('click', async () => {
  if (!currentJobId) return;
  const stemName = noteStemSelect.value;
  analyzeNotesButton.disabled = true; noteStemSelect.disabled = true;
  noteAnalysisStatus.textContent = `Analyzing ${stemName} stem… This runs locally and may take a little while.`;
  try {
    const response = await fetch(`/api/jobs/${currentJobId}/notes/${stemName}`, {method: 'POST'});
    const result = await response.json();
    if (!response.ok) throw new Error(result.detail || 'Analysis failed.');
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
    if (currentJobId === trackId) document.querySelector('#result-filename').textContent = result.track.title || result.track.filename || 'Backing track';
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
function updateTimeDisplay() {
  const current = Number.isFinite(audioPlayer.currentTime) ? audioPlayer.currentTime : 0;
  const duration = Number.isFinite(audioPlayer.duration) ? audioPlayer.duration : 0;
  timeDisplay.textContent = `${formatTime(current)} / ${formatTime(duration)}`;
  if (playbackSeek && !playbackSeek.matches(':active')) {
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
playbackSeek.addEventListener('input', () => { if (Number.isFinite(audioPlayer.duration)) audioPlayer.currentTime = Math.min(audioPlayer.duration, Number(playbackSeek.value) / 10); });
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
audioPlayer.addEventListener('seeked', () => { syncStemPlayers(true); updateCurrentNote(true); });
audioPlayer.addEventListener('ratechange', () => { syncStemPlayers(true); updateMetronomeBpmDisplay(); resetMetronomeGrid(); });
audioPlayer.addEventListener('timeupdate', () => {
  updateTimeDisplay();
  updateCurrentNote();
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
  if (noteAnalysisPollTimer) { clearTimeout(noteAnalysisPollTimer); noteAnalysisPollTimer = null; }
  noteAnalysisRequestToken++;
  audioPlayer.pause(); stopMetronome(); stopStemPlayers();
  metronomeMuted = false; metronomeDownbeatOffset = 0; metronomeBpmInput = null; metronomeLevelInput = null; metronomeLevelValue = null; metronomeMuteButton = null; metronomeSoloButton = null;
  playerArea.hidden = false; mixerEmptyState.hidden = true; separatorPanel.hidden = true; jobProgress.hidden = true; currentJobId = job.id; setPracticeMode(practiceMode, false);
  document.querySelector('#result-filename').textContent = job.title || (job.filename || 'Backing track').replace(/\.[^.]+$/, '');
  audioPlayer.src = job.backing_url; audioPlayer.volume = masterGain(); audioPlayer.playbackRate = 1; speedSelect.value = '1';
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
  mixerModelLabel.textContent = job.model === 'htdemucs_6s' ? '6 stems · vocals, drums, bass, guitar, piano, other' : '4 stems · vocals, drums, bass, other';
  renderStems(currentStems);
  loadPitchAnalysis(noteStemSelect.value);
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
