// If no saved settings, redirect to settings page
if (!localStorage.getItem('trainerSettings')) {
  window.location.replace('index.html');
}

const AudioContext = window.AudioContext || window.webkitAudioContext;
let audioCtx; // Will be initialized in initAudio()

const intervals = {
  "minor 2nd": 1,
  "major 2nd": 2,
  "minor 3rd": 3,
  "major 3rd": 4,
  "perfect 4th": 5,
  "tritone": 6,
  "perfect 5th": 7,
  "minor 6th": 8,
  "major 6th": 9,
  "minor 7th": 10,
  "major 7th": 11,
  "octave": 12
};

const notes = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

function noteToFrequency(note, octave) {
  const index = notes.indexOf(note);
  const semitone = (octave - 4) * 12 + index;
  return 261.63 * Math.pow(2, semitone / 12);
}

function frequencyToNote(freq) {
  const noteNum = 12 * (Math.log(freq / 440) / Math.log(2));
  const rounded = Math.round(noteNum) + 69;
  const noteName = notes[rounded % 12];
  const octave = Math.floor(rounded / 12) - 1;
  return { name: noteName, octave, full: `${noteName}${octave}`, semitone: rounded };
}

// Create a map to store our loaded samples
const samples = new Map();

// Function to initialize audio context
async function initAudio() {
  try {
    // Create audio context but don't start it yet
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    console.log('Audio context created (suspended)');
    
    // Load the correct sound effect
    correctAudio = new Audio('Sound Effects/Correct.mp3');
    correctAudio.preload = 'auto';
    
    // Start loading samples
    await preloadSamples();
    console.log('Samples loaded');
    
    // Function to resume audio context and unlock audio
    const unlockAudio = async () => {
      try {
        // Resume the audio context (required after user interaction)
        if (audioCtx.state === 'suspended') {
          await audioCtx.resume();
          console.log('Audio context resumed');
        }
        
        // Play a silent buffer to ensure audio is fully unlocked
        const buffer = audioCtx.createBuffer(1, 1, 22050);
        const source = audioCtx.createBufferSource();
        source.buffer = buffer;
        source.connect(audioCtx.destination);
        source.start(0);
        
        console.log('Audio unlocked');
        return true;
      } catch (e) {
        console.error('Error unlocking audio:', e);
        return false;
      }
    };
    
    // Set up user interaction handler
    const handleFirstInteraction = async () => {
      await unlockAudio();
      // Remove these event listeners after first interaction
      document.removeEventListener('click', handleFirstInteraction);
      document.removeEventListener('touchstart', handleFirstInteraction);
      
      // Preload the correct sound after first interaction
      try {
        await correctAudio.load();
        console.log('Correct sound preloaded');
      } catch (e) {
        console.error('Error preloading correct sound:', e);
      }
    };
    
    // Set up interaction listeners
    document.addEventListener('click', handleFirstInteraction, { once: true });
    document.addEventListener('touchstart', handleFirstInteraction, { once: true });
    
    // Try to unlock immediately (will work on some browsers)
    unlockAudio().catch(console.error);
    
  } catch (error) {
    console.error('Error initializing audio:', error);
  }
}

// --- NEW: Sample loading uses direct note name, e.g. C4.ogg, C#4.ogg ---
// Remove old sampleFileMap. All samples are named e.g. C4.ogg, C#4.ogg, etc.
// Only sharps are used in the naming, no flats.



// Function to load a sample
async function loadSample(note) {
  const filename = `${note}.ogg`;
  try {
    // Encode the filename to handle special characters like #
    const encodedFilename = encodeURIComponent(filename);
    const response = await fetch(`Samples/Piano/${encodedFilename}`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
    samples.set(note, audioBuffer);
    console.log(`Successfully loaded sample: ${filename}`);
  } catch (error) {
    console.error(`Error loading sample for note ${note} from file ${filename}:`, error);
    // Don't throw so the app can continue.
  }
}


// Function to play a sample
function playSample(note, retryCount = 0) {
  if (!audioCtx || audioCtx.state !== 'running') {
    console.error('Audio context not running, user interaction may be needed.');
    return;
  }

  const sample = samples.get(note);
  if (!sample) {
    if (retryCount < 10) {
      // Try again after a short delay if sample is still loading.
      setTimeout(() => {
        playSample(note, retryCount + 1);
      }, 100);
    } else {
      console.error(`Sample not loaded for note ${note} after multiple attempts.`);
    }
    return;
  }

  const source = audioCtx.createBufferSource();
  source.buffer = sample;
  
  const gainNode = audioCtx.createGain();
  gainNode.gain.value = 0.5;
  
  source.connect(gainNode);
  gainNode.connect(audioCtx.destination);
  
  source.start(); // Play full sample, do not stop early
}
// If you want to preload all samples at startup to minimize latency, you can add a function like this:
// async function preloadAllSamples() {
//   const promises = [];
//   for (let octave = 0; octave <= 8; octave++) {
//     for (const note of notes) {
//       promises.push(loadSample(`${note}${octave}`));
//     }
//   }
//   await Promise.all(promises);
// }



// Function to convert MIDI note to sample filename (always sharps)
function midiToSampleName(midiNote) {
  const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const noteIndex = midiNote % 12;
  const octave = Math.floor(midiNote / 12) - 1;
  return `${noteNames[noteIndex]}${octave}`;
}

function playNote(frequency) {
  const midiNote = Math.round(69 + 12 * Math.log(frequency / 440) / Math.log(2));
  const sampleName = midiToSampleName(midiNote);

  // Try to load the sample if not already loaded
  if (!samples.has(sampleName)) {
    loadSample(sampleName);
  }
  playSample(sampleName);
}



// Preload some common samples when the page loads
// Preload ALL piano samples (A0-C8) at startup
// Preload all .ogg files in the Samples/Piano directory
async function preloadSamples() {
  // List of all .ogg files found in the directory (generated by build script or backend)
  const sampleFiles = [
    "A#0.ogg","A#1.ogg","A#2.ogg","A#3.ogg","A#4.ogg","A#5.ogg","A#6.ogg","A#7.ogg",
    "A0.ogg","A1.ogg","A2.ogg","A3.ogg","A4.ogg","A5.ogg","A6.ogg","A7.ogg",
    "B0.ogg","B1.ogg","B2.ogg","B3.ogg","B4.ogg","B5.ogg","B6.ogg","B7.ogg",
    "C#1.ogg","C#2.ogg","C#3.ogg","C#4.ogg","C#5.ogg","C#6.ogg","C#7.ogg",
    "C1.ogg","C2.ogg","C3.ogg","C4.ogg","C5.ogg","C6.ogg","C7.ogg","C8.ogg",
    "D#1.ogg","D#2.ogg","D#3.ogg","D#4.ogg","D#5.ogg","D#6.ogg","D#7.ogg",
    "D1.ogg","D2.ogg","D3.ogg","D4.ogg","D5.ogg","D6.ogg","D7.ogg",
    "E1.ogg","E2.ogg","E3.ogg","E4.ogg","E5.ogg","E6.ogg","E7.ogg",
    "F#1.ogg","F#2.ogg","F#3.ogg","F#4.ogg","F#5.ogg","F#6.ogg","F#7.ogg",
    "F1.ogg","F2.ogg","F3.ogg","F4.ogg","F5.ogg","F6.ogg","F7.ogg",
    "G#1.ogg","G#2.ogg","G#3.ogg","G#4.ogg","G#5.ogg","G#6.ogg","G#7.ogg",
    "G1.ogg","G2.ogg","G3.ogg","G4.ogg","G5.ogg","G6.ogg","G7.ogg"
  ];
  console.log('Starting to preload all available samples...');
  const promises = sampleFiles.map(file => loadSample(file.replace('.ogg','')));
  await Promise.all(promises);
  console.log('All available samples preloaded');
}


// Initialize everything when the page loads
document.addEventListener('DOMContentLoaded', () => {
  const startPlayingBtn = document.getElementById('startPlayingBtn');
  const checkAnswerBtn = document.getElementById('checkAnswer');
  const replayReferenceBtn = document.getElementById('replayReference');
  const nextQuestionBtn = document.getElementById('nextQuestion');
  const settingsBtn = document.getElementById('settingsBtn');

  // Add listener to the start button
  startPlayingBtn.addEventListener('click', async () => {
    // 1. Initialize audio and mic. This click is the user interaction needed by browsers.
    await initAudio();
    startMicAndAnalyser();

    // 2. Hide start button, show other buttons
    startPlayingBtn.style.display = 'none';
    checkAnswerBtn.style.display = 'inline-block';
    replayReferenceBtn.style.display = 'inline-block';
    nextQuestionBtn.style.display = 'inline-block';
    settingsBtn.style.display = 'inline-block';

    // 3. Load settings and start the first question
    loadSettings();
    updateQuestionCounter();
    newQuestion();
  });

  // Attach the settings button listener
  if (settingsBtn) {
    settingsBtn.addEventListener('click', () => {
      window.location.href = 'index.html';
    });
  }
});

let referenceNote, targetFreq, targetSemitone;

// --- Slider (vocal range) handling ---
const minSlider = document.getElementById('noteRangeMin');
const maxSlider = document.getElementById('noteRangeMax');
const minNoteLabelEl = document.getElementById('minNoteLabel');
const maxNoteLabelEl = document.getElementById('maxNoteLabel');
const rangeFill = document.getElementById('slider-range-fill');

// Map slider index (0-87) to MIDI note (A0 = 21)
function sliderIndexToMidi(idx) {
  return 21 + idx; // 0=>21, 87=>108
}
function midiToSliderIndex(midi) {
  return midi - 21;
}
function sliderIndexToNoteName(idx) {
  return midiToSampleName(sliderIndexToMidi(idx));
}

let rangeMinIdx = parseInt(minSlider.value);
let rangeMaxIdx = parseInt(maxSlider.value);

function updateRangeLabels() {
  minNoteLabelEl.textContent = sliderIndexToNoteName(rangeMinIdx);
  maxNoteLabelEl.textContent = sliderIndexToNoteName(rangeMaxIdx);
}

function updateRangeFill() {
  const minPosPercent = (minSlider.value / minSlider.max) * 100;
  const maxPosPercent = (maxSlider.value / maxSlider.max) * 100;
  rangeFill.style.left = `${minPosPercent}%`;
  rangeFill.style.width = `${maxPosPercent - minPosPercent}%`;
}

updateRangeLabels();
updateRangeFill();

function enforceSliderBounds() {
  rangeMinIdx = Math.min(parseInt(minSlider.value), parseInt(maxSlider.value)-1);
  rangeMaxIdx = Math.max(parseInt(maxSlider.value), rangeMinIdx+1);
  minSlider.value = rangeMinIdx;
  maxSlider.value = rangeMaxIdx;
  updateRangeLabels();
  updateRangeFill();
}

minSlider.addEventListener('input', enforceSliderBounds);
maxSlider.addEventListener('input', enforceSliderBounds);
let currentInterval = "";
let currentDirection = "";
let autoNextEnabled = false;

// --- Session settings ---
let questionLimit = 0; // 0 = infinite
let questionCount = 0;

function updateQuestionCounter() {
  const el = document.getElementById('questionCounter');
  if (!el) return;
  if (questionLimit > 0) {
    el.textContent = `Question ${questionCount} of ${questionLimit}`;
  } else {
    el.textContent = `Question ${questionCount}`;
  }
}

function loadSettings() {
  const sStr = localStorage.getItem('trainerSettings');
  if (!sStr) return;
  try {
    const s = JSON.parse(sStr);
    // Range sliders
    if (s.rangeMinIdx !== undefined) minSlider.value = s.rangeMinIdx;
    if (s.rangeMaxIdx !== undefined) maxSlider.value = s.rangeMaxIdx;
    enforceSliderBounds();
    // Toggles
    if (typeof s.octaveAgnostic === 'boolean') {
      document.getElementById('octaveAgnosticToggle').checked = s.octaveAgnostic;
      octaveAgnostic = s.octaveAgnostic;
    }
    if (typeof s.autoNext === 'boolean') {
      document.getElementById('autoNextToggle').checked = s.autoNext;
      autoNextEnabled = s.autoNext;
    }
    // Directions
    if (Array.isArray(s.directions)) {
      document.querySelectorAll('.directions-container input').forEach(cb => {
        cb.checked = s.directions.includes(cb.value);
      });
    }
    // Intervals
    if (Array.isArray(s.intervals)) {
      document.querySelectorAll('#intervalCheckboxes input').forEach(cb => {
        cb.checked = s.intervals.includes(cb.value);
      });
    }
    questionLimit = s.numQuestions || 0;
  } catch (e) {
    console.error('Invalid trainer settings in storage', e);
  }
}

function getSelectedIntervals() {
  const checkboxes = document.querySelectorAll(".intervals-container input[type=checkbox]:checked");
  return Array.from(checkboxes).map(cb => cb.value);
}

function getSelectedDirections() {
  const checkboxes = document.querySelectorAll(".directions-container input[type=checkbox]:checked");
  return Array.from(checkboxes).map(cb => cb.value);
}

function newQuestion() {
  if (questionLimit > 0 && questionCount >= questionLimit) {
    document.getElementById("prompt").innerText = "Session complete!";
    return;
  }
  questionCount++;
  updateQuestionCounter();
  enforceSliderBounds();
  document.getElementById("feedback").innerText = "";
  correctLocked = false;
  correctDuration = 0;

  let validQuestionFound = false;
  let attempts = 0;
  const maxAttempts = 200; // Prevent infinite loops

  // Convert slider indices to MIDI note numbers (A0 = 21)
  const minSemitone = sliderIndexToMidi(rangeMinIdx); // MIDI note of slider min
  const maxSemitone = sliderIndexToMidi(rangeMaxIdx);

  while (!validQuestionFound && attempts < maxAttempts) {
    attempts++;

    const randomOctave = Math.floor(Math.random() * 7) + 1;
    const randomNoteName = notes[Math.floor(Math.random() * notes.length)];
    const tempReferenceNote = { name: randomNoteName, octave: randomOctave };
    // MIDI note number: (octave+1)*12 + noteIndex
    const referenceIndex = ((tempReferenceNote.octave + 1) * 12) + notes.indexOf(tempReferenceNote.name);

    const selectedIntervals = Array.from(document.querySelectorAll("#intervalCheckboxes input:checked")).map(cb => cb.value);
    if (selectedIntervals.length === 0) {
      if (attempts === 1) alert("Please select at least one interval.");
      return;
    }
    const tempInterval = selectedIntervals[Math.floor(Math.random() * selectedIntervals.length)];

    const selectedDirections = Array.from(document.querySelectorAll(".directions-container input:checked")).map(cb => cb.value);
    if (selectedDirections.length === 0) {
      if (attempts === 1) alert("Please select a direction (Up/Down).");
      return;
    }
    const tempDirection = selectedDirections[Math.floor(Math.random() * selectedDirections.length)];

    const intervalDistance = intervals[tempInterval];
    const directionMultiplier = tempDirection === "up" ? 1 : -1;
    const targetIndex = referenceIndex + (intervalDistance * directionMultiplier);

    if (targetIndex >= minSemitone && targetIndex <= maxSemitone) {
      validQuestionFound = true;

      referenceNote = tempReferenceNote;
      currentInterval = tempInterval;
      currentDirection = tempDirection;

      const targetNoteName = notes[((targetIndex % 12) + 12) % 12];
      // Fix: Avoid floating point errors in octave calculation
      const targetOctave = Math.floor((targetIndex + 0.00001) / 12) - 1;

      targetFreq = noteToFrequency(targetNoteName, targetOctave);
      targetSemitone = targetIndex;

      const referenceNoteString = `${referenceNote.name}${referenceNote.octave}`;
      // Capitalize interval for display
      const intervalDisplay = currentInterval.replace(/\b\w/g, c => c.toUpperCase());
      document.getElementById("prompt").innerText = `Reference note: ${referenceNoteString}, Interval: ${intervalDisplay} ${currentDirection}`;
      setTimeout(() => playSample(referenceNoteString), 100); // Ensure context is unlocked before playing

    }
  }

  if (!validQuestionFound) {
    console.error(`Could not find a valid question within the selected range after ${maxAttempts} attempts.`);
    document.getElementById("prompt").innerText = "Could not find a valid question. Please widen the range or change interval selections.";
  }
}



const canvas = document.getElementById("volumeMeter");
const canvasCtx = canvas.getContext("2d");
let analyser;
let microphone;
let isListening = false;
const detectedNoteEl = document.getElementById("detectedNote");
const feedbackEl = document.getElementById("feedback");

// --- GLOBALS for correct logic ---
let correctDuration = 0;
let correctLocked = false;
let correctAudio = null;
let octaveAgnostic = true;

// Wire up octave-agnostic toggle
const octaveAgnosticToggle = document.getElementById('octaveAgnosticToggle');
if (octaveAgnosticToggle) {
  octaveAgnosticToggle.checked = true;
  octaveAgnostic = true;
  octaveAgnosticToggle.addEventListener('change', (e) => {
    octaveAgnostic = e.target.checked;
  });
}

function startMicAndAnalyser() {
  navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
  const source = audioCtx.createMediaStreamSource(stream);
  const analyser = audioCtx.createAnalyser();
  analyser.fftSize = 2048;
  source.connect(analyser);
  const buffer = new Float32Array(analyser.fftSize);


  function autoCorrelate(buf, sampleRate) {
    let SIZE = buf.length;
    let rms = 0;
    for (let i = 0; i < SIZE; i++) rms += buf[i] * buf[i];
    rms = Math.sqrt(rms / SIZE);
    if (rms < 0.003) return -1;

    let r1 = 0, r2 = SIZE - 1, threshold = 0.01;
    for (let i = 0; i < SIZE / 2; i++) {
      if (Math.abs(buf[i]) < threshold) {
        r1 = i;
        break;
      }
    }
    for (let i = 1; i < SIZE / 2; i++) {
      if (Math.abs(buf[SIZE - i]) < threshold) {
        r2 = SIZE - i;
        break;
      }
    }

    buf = buf.slice(r1, r2);
    SIZE = buf.length;

    let c = new Array(SIZE).fill(0);
    for (let i = 0; i < SIZE; i++)
      for (let j = 0; j < SIZE - i; j++)
        c[i] = c[i] + buf[j] * buf[j + i];

    let d = 0;
    while (c[d] > c[d + 1]) d++;
    let maxval = -1, maxpos = -1;
    for (let i = d; i < SIZE; i++) {
      if (c[i] > maxval) {
        maxval = c[i];
        maxpos = i;
      }
    }
    let T0 = maxpos;
    return sampleRate / T0;
  }

  function draw() {
    analyser.getFloatTimeDomainData(buffer);
    canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
    const volume = buffer.reduce((a, b) => a + Math.abs(b), 0) / buffer.length;
    const height = volume * canvas.height * 10;
    canvasCtx.fillStyle = 'green';
    canvasCtx.fillRect(0, canvas.height - height, canvas.width, height);

    const pitch = autoCorrelate(buffer, audioCtx.sampleRate);
    if (pitch !== -1) {
      const note = frequencyToNote(pitch);
      detectedNoteEl.innerText = note.full;
      let isCorrect = false;
      if (octaveAgnostic) {
        // Always use positive mod 12 for both
        const detectedMod = ((note.semitone % 12) + 12) % 12;
        const targetMod = ((targetSemitone % 12) + 12) % 12;
        isCorrect = (detectedMod === targetMod);
      } else {
        isCorrect = (note.semitone === targetSemitone);
      }
      if (!correctLocked && isCorrect) {
        correctDuration += 1 / 60;
        if (correctDuration >= 1) {
          feedbackEl.innerText = `Correct! That was a ${currentInterval} ${currentDirection}`;
          correctLocked = true;
          // Play correct sound effect
          if (correctAudio) {
            try {
              // Ensure we're at the start and play
              correctAudio.currentTime = 0;
              const playPromise = correctAudio.play();
              
              // Handle any play errors
              if (playPromise !== undefined) {
                playPromise.catch(error => {
                  console.log('Audio play failed, trying to unlock audio:', error);
                  // If play failed, try to unlock audio and play again
                  unlockAudio().then(() => {
                    correctAudio.currentTime = 0;
                    correctAudio.play().catch(e => console.error('Still failed to play:', e));
                  });
                });
              }
            } catch (e) {
              console.error('Error playing correct sound:', e);
            }
          }
          if (autoNextEnabled) {
            setTimeout(() => {
              correctLocked = false;
              newQuestion();
            }, 1500);
          }
        }
      } else if (!correctLocked) {
        correctDuration = 0;
        feedbackEl.innerText = "";
      }
    } else if (!correctLocked) {
      detectedNoteEl.innerText = "-";
      correctDuration = 0;
      feedbackEl.innerText = "";
    }

    requestAnimationFrame(draw);
  }
  draw();
  });
}

document.getElementById("checkAnswer").addEventListener("click", () => {
  if (targetSemitone === undefined) return;
  const targetNoteName = notes[((targetSemitone % 12) + 12) % 12];
  const targetOctave = Math.floor((targetSemitone + 0.00001) / 12) - 1;
  playSample(`${targetNoteName}${targetOctave}`);
  // Show target note
  const targetNoteStr = `${targetNoteName}${targetOctave}`;
  let targetNoteDisplay = document.getElementById("targetNoteDisplay");
  if (!targetNoteDisplay) {
    targetNoteDisplay = document.createElement("div");
    targetNoteDisplay.id = "targetNoteDisplay";
    targetNoteDisplay.style.fontWeight = "bold";
    targetNoteDisplay.style.marginTop = "10px";
    feedbackEl.parentNode.insertBefore(targetNoteDisplay, feedbackEl.nextSibling);
  }
  targetNoteDisplay.innerText = `Target note: ${targetNoteStr}`;
});

document.getElementById("nextQuestion").addEventListener("click", () => {
  correctLocked = false;
  correctDuration = 0;
  let targetNoteDisplay = document.getElementById("targetNoteDisplay");
  if (targetNoteDisplay) targetNoteDisplay.innerText = "";
  newQuestion();
});

document.getElementById("replayReference").addEventListener("click", () => {
  if (!referenceNote) return;
  playSample(`${referenceNote.name}${referenceNote.octave}`);
});

document.getElementById("autoNextToggle").addEventListener("change", (e) => {
  autoNextEnabled = e.target.checked;
});

const checkboxContainer = document.getElementById("intervalCheckboxes");
Object.keys(intervals).forEach(interval => {
  const label = document.createElement("label");
  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.value = interval;
  checkbox.checked = true;
  // Capitalize each word
  const intervalDisplay = interval.replace(/\b\w/g, c => c.toUpperCase());
  label.appendChild(checkbox);
  label.appendChild(document.createTextNode(intervalDisplay));
  checkboxContainer.appendChild(label);
});