const form = document.querySelector('#upload-form');
const fileInput = document.querySelector('#audio-file');
const fileLabel = document.querySelector('#file-label');
const dropZone = document.querySelector('#drop-zone');
const modelSelect = document.querySelector('#model');
const excludeSelect = document.querySelector('#exclude');
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
let pollTimer = null;
let currentStems = {};

const stemOptions = {
  htdemucs: [['vocals','Vocals'],['drums','Drums'],['bass','Bass'],['other','Other instruments']],
  htdemucs_6s: [['vocals','Vocals'],['drums','Drums'],['bass','Bass'],['guitar','Guitar'],['piano','Piano'],['other','Other instruments']],
};
function refreshStemOptions() {
  const previous = excludeSelect.value;
  excludeSelect.replaceChildren();
  for (const [value, label] of stemOptions[modelSelect.value]) {
    const option = document.createElement('option'); option.value = value; option.textContent = label;
    excludeSelect.append(option);
  }
  if ([...excludeSelect.options].some(o => o.value === previous)) excludeSelect.value = previous;
}
modelSelect.addEventListener('change', refreshStemOptions);
refreshStemOptions();
fileInput.addEventListener('change', () => { fileLabel.textContent = fileInput.files[0]?.name || 'Drop an audio file here'; });
for (const eventName of ['dragenter','dragover']) dropZone.addEventListener(eventName, e => { e.preventDefault(); dropZone.classList.add('dragging'); });
for (const eventName of ['dragleave','drop']) dropZone.addEventListener(eventName, e => { e.preventDefault(); dropZone.classList.remove('dragging'); });
dropZone.addEventListener('drop', e => { if (e.dataTransfer.files.length) { fileInput.files = e.dataTransfer.files; fileLabel.textContent = fileInput.files[0].name; } });

function showError(message) { errorBox.hidden = false; errorBox.textContent = message; }
function setProgress(status) {
  const widths = {queued: '8%', processing: '65%', completed: '100%', failed: '100%'};
  progressBar.style.width = widths[status] || '15%';
}
function renderStems(stems) {
  stemsList.replaceChildren();
  for (const [name, url] of Object.entries(stems || {})) {
    const a = document.createElement('a'); a.className = 'stem-link'; a.href = url; a.download = `${name}.wav`;
    const label = document.createElement('strong'); label.textContent = name[0].toUpperCase() + name.slice(1);
    const download = document.createElement('span'); download.textContent = '↓ WAV';
    a.append(label, download); stemsList.append(a);
  }
}
async function pollJob(id) {
  try {
    const response = await fetch(`/api/jobs/${id}`);
    const job = await response.json();
    if (!response.ok) throw new Error(job.detail || 'Could not read job status.');
    jobMessage.textContent = job.progress || job.status;
    setProgress(job.status);
    if (job.status === 'completed') {
      clearInterval(pollTimer); pollTimer = null;
      playerArea.hidden = false;
      document.querySelector('#result-filename').textContent = job.filename || 'Backing track';
      audioPlayer.src = job.backing_url;
      downloadLink.href = job.download_url;
      currentStems = job.stems || {};
      renderStems(currentStems);
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
  resultPanel.hidden = false; errorBox.hidden = true; playerArea.hidden = true;
  audioPlayer.pause(); audioPlayer.removeAttribute('src'); audioPlayer.load();
  stemsList.hidden = true; stemsToggle.textContent = 'Show individual stems';
  jobMessage.textContent = 'Uploading audio…'; progressBar.style.width = '3%';
  submitButton.disabled = true; submitButton.querySelector('span:first-child').textContent = 'Processing…';
  const data = new FormData(form);
  data.set('exclude', excludeSelect.value);
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
stemsToggle.addEventListener('click', () => { stemsList.hidden = !stemsList.hidden; stemsToggle.textContent = stemsList.hidden ? 'Show individual stems' : 'Hide individual stems'; });
