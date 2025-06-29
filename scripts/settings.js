
document.addEventListener('DOMContentLoaded', () => {
  // --- duplicate constants (small overhead) ---
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

  // Populate interval checkboxes with capitalised labels
  const checkboxContainer = document.getElementById('intervalCheckboxes');
  Object.keys(intervals).forEach(interval => {
    const label = document.createElement('label');
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.value = interval;
    cb.checked = true;
    const display = interval.replace(/\b\w/g, c => c.toUpperCase());
    label.appendChild(cb);
    label.appendChild(document.createTextNode(display));
    checkboxContainer.appendChild(label);
  });

  // Handle slider label updates and range fill (reuse minimal helpers)
  const minSlider = document.getElementById('noteRangeMin');
  const maxSlider = document.getElementById('noteRangeMax');
  const minLabel = document.getElementById('minNoteLabel');
  const maxLabel = document.getElementById('maxNoteLabel');
  const rangeFill = document.getElementById('slider-range-fill');
  const notes = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  const sliderIndexToMidi = idx => 21 + idx;
  const midiToName = midi => {
    const name = notes[midi % 12];
    const octave = Math.floor(midi / 12) - 1;
    return name + octave;
  };
  function updateLabels() {
    minLabel.textContent = midiToName(sliderIndexToMidi(parseInt(minSlider.value)));
    maxLabel.textContent = midiToName(sliderIndexToMidi(parseInt(maxSlider.value)));
  }
  function updateFill() {
    const minVal = parseInt(minSlider.value);
    const maxVal = parseInt(maxSlider.value);
    const minP = ((minVal - minSlider.min) / (minSlider.max - minSlider.min)) * 100;
    const maxP = ((maxVal - minSlider.min) / (minSlider.max - minSlider.min)) * 100;
    rangeFill.style.left = `${minP}%`;
    rangeFill.style.width = `${maxP - minP}%`;
  }
  function enforceBounds() {
    const minVal = Math.min(parseInt(minSlider.value), parseInt(maxSlider.value)-1);
    const maxVal = Math.max(parseInt(maxSlider.value), minVal+1);
    minSlider.value = minVal;
    maxSlider.value = maxVal;
    updateLabels();
    updateFill();
  }
  minSlider.addEventListener('input', enforceBounds);
  maxSlider.addEventListener('input', enforceBounds);
  enforceBounds();

  document.getElementById('startSession').addEventListener('click', () => {
    // collect data
    const data = {
      rangeMinIdx: parseInt(minSlider.value),
      rangeMaxIdx: parseInt(maxSlider.value),
      octaveAgnostic: document.getElementById('octaveAgnosticToggle').checked,
      autoNext: document.getElementById('autoNextToggle').checked,
      directions: Array.from(document.querySelectorAll('#directions-container input')).filter(cb => cb.checked).map(cb => cb.value),
      intervals: Array.from(document.querySelectorAll('#intervalCheckboxes input')).filter(cb => cb.checked).map(cb => cb.value),
      numQuestions: parseInt(document.getElementById('numQuestions').value) || 0
    };
    localStorage.setItem('trainerSettings', JSON.stringify(data));
    window.location.href = 'Trainer.html';
  });
});
