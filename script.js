// Load word lists
import { wordList as wordListHard } from './wordList.js';
import { wordList as wordListMedium } from './wordList-medium.js';
import { wordList as wordListEasy } from './wordList-easy.js';
import { wordListFull } from './wordList-full.js';

// Core game state
const state = {
  grid: [],
  finalWordList: [],
  wordList: [],
  stsqRowList: [],
  stsqColList: [],
  finalWordCount: 0,
  selectedCell: null,
  locsToBlankX: [],
  locsToBlankY: [],
  lettersRemoved: [],
  correctWord: '', // Will store the sixth word for checking
  filledPositions: 0,// Track how many blanks have been filled
  wordPositions: [],
  gameStartTime: null // Track when the current puzzle started
};

// DOM Elements
const elements = {
  gridboard: document.getElementById('game-board'),
  letterButtons: {
    but1: document.getElementById('let1'),
    but2: document.getElementById('let2'),
    but3: document.getElementById('let3'),
    but4: document.getElementById('let4'),
    but5: document.getElementById('let5')
  },
  newPuzzleButton: document.getElementById('new-puzzle-button'),
  resetButton: document.getElementById('reset-button'),
  hintButton: document.getElementById('hint-button'),
  showAnswerButton: document.getElementById('show-answer-button'),
  tryNumberfiveButton: document.getElementById('try-numberfive-button')
};

// Function to get current word list based on difficulty
function getCurrentWordList() {
  const difficulty = getDifficulty();
  switch (difficulty) {
    case 'easy':
      return wordListEasy;
    case 'medium':
      return wordListMedium;
    case 'hard':
    case 'veryhard':
      return wordListHard;
    default:
      return wordListMedium;
  }
}

// Statistics Management
function getStatistics() {
  const defaultStats = {
    puzzlesSolved: 0,
    totalSolveTime: 0, // in seconds
    shortestSolveTime: null // in seconds
  };

  const saved = localStorage.getItem('wordfive-statistics');
  return saved ? JSON.parse(saved) : defaultStats;
}

function saveStatistics(stats) {
  localStorage.setItem('wordfive-statistics', JSON.stringify(stats));
}

// Difficulty Management
function getDifficulty() {
  const saved = localStorage.getItem('wordfive-difficulty');
  return saved || 'medium'; // Default to medium
}

function saveDifficulty(difficulty) {
  localStorage.setItem('wordfive-difficulty', difficulty);
}

// Reset statistics
function resetStatistics() {
  const defaultStats = {
    puzzlesSolved: 0,
    totalSolveTime: 0,
    shortestSolveTime: null
  };
  saveStatistics(defaultStats);
  return defaultStats;
}

function updateStatistics(solveTimeSeconds) {
  const stats = getStatistics();

  stats.puzzlesSolved++;
  stats.totalSolveTime += solveTimeSeconds;

  if (stats.shortestSolveTime === null || solveTimeSeconds < stats.shortestSolveTime) {
    stats.shortestSolveTime = solveTimeSeconds;
  }

  saveStatistics(stats);
  return stats;
}

function formatTime(seconds) {
  if (seconds === null) return 'N/A';

  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);

  if (mins === 0) {
    return `${secs}s`;
  }
  return `${mins}m ${secs}s`;
}

// Timer visibility functions
function saveTimerVisibility(isVisible) {
  localStorage.setItem('timerVisible', JSON.stringify(isVisible));
}

function getTimerVisibility() {
  const saved = localStorage.getItem('timerVisible');
  return saved !== null ? JSON.parse(saved) : false;
}

// Timer display functions
let timerInterval = null;
let timerPaused = false;

function createTimerDisplay() {
  const header = document.querySelector('.game-header');
  if (!header) return;

  // Check if timer already exists
  if (document.getElementById('game-timer')) return;

  const timerDiv = document.createElement('div');
  timerDiv.id = 'game-timer';
  timerDiv.style.cssText = `
    position: absolute;
    left: 50%;
    transform: translateX(-50%);
    font-size: 18px;
    color: #22c55e;
    font-weight: 500;
    font-family: monospace;
  `;
  timerDiv.textContent = '0:00';

  header.appendChild(timerDiv);
}

function updateTimerDisplay() {
  const timerDiv = document.getElementById('game-timer');
  const isVisible = getTimerVisibility();

  if (isVisible) {
    if (!timerDiv) {
      createTimerDisplay();
    } else {
      timerDiv.style.display = 'block';
    }
    startTimerInterval();
  } else {
    if (timerDiv) {
      timerDiv.style.display = 'none';
    }
    stopTimerInterval();
  }
}

function startTimerInterval() {
  if (timerInterval) return; // Already running

  timerInterval = setInterval(() => {
    if (!timerPaused && state.gameStartTime) {
      const elapsedSeconds = Math.floor((Date.now() - state.gameStartTime) / 1000);
      updateTimerText(elapsedSeconds);
    }
  }, 1000);
}

function stopTimerInterval() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
}

function pauseTimer() {
  timerPaused = true;
}

function resumeTimer() {
  timerPaused = false;
}

function resetTimer() {
  timerPaused = false;
  const timerDiv = document.getElementById('game-timer');
  if (timerDiv && getTimerVisibility()) {
    timerDiv.textContent = '0:00';
  }
}

function updateTimerText(seconds) {
  const timerDiv = document.getElementById('game-timer');
  if (!timerDiv) return;

  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  timerDiv.textContent = `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Create initial empty grid
function createEmptyGrid() {
  // Clear existing grid content
  elements.gridboard.innerHTML = '';

  // Create 5x5 grid
  for (let i = 0; i < 5; i++) {
    const row = document.createElement('tr');
    for (let j = 0; j < 5; j++) {
      const cell = document.createElement('td');
      cell.textContent = '_';
      row.appendChild(cell);
    }
    elements.gridboard.appendChild(row);
  }

  // Initialize state grid array
  state.grid = Array(5).fill().map(() => Array(5).fill('_'));
}

// Create and style a cell
/// Update createCell function to maintain proper classes
function createCell(row, col, content) {
  const cell = document.createElement('td');
  cell.textContent = content;
  cell.dataset.row = row;
  cell.dataset.col = col;

  // Check if this is a position that should be empty
  const isEmptyPosition = state.locsToBlankX.some((x, i) => 
    x === row && state.locsToBlankY[i] === col
  );

  if (isEmptyPosition) {
    if (content === ' ') {
      cell.classList.add('empty-cell');
    } else {
      cell.classList.add('player-placed');
      cell.style.color = 'red';
    }
  }

  return cell;
}

// Update grid display
function updateGridDisplay() {
  elements.gridboard.innerHTML = '';

  for (let i = 0; i < 5; i++) {
    const row = document.createElement('tr');
    for (let j = 0; j < 5; j++) {
      const cell = createCell(i, j, state.grid[i][j]);
      row.appendChild(cell);
    }
    elements.gridboard.appendChild(row);
  }
}

// Add click handlers for all grid cells
function setupLetterButtons() {
  document.addEventListener('click', (e) => {
    // If clicking outside of a cell, remove highlighting
    if (!e.target.matches('td')) {
      if (state.selectedCell) {
        state.selectedCell.classList.remove('highlighted');
        state.selectedCell = null;
      }
    }
  });

  // Add click handlers for all grid cells
  elements.gridboard.addEventListener('click', (e) => {
    const cell = e.target;
    if (cell.tagName === 'TD') {
      const row = parseInt(cell.dataset.row);
      const col = parseInt(cell.dataset.col);

      // Check if this cell is a valid position for letter placement
      const isValidPosition = state.locsToBlankX.some((x, i) =>
        x === row && state.locsToBlankY[i] === col
      );

      // Handle clicking on a filled square - remove the letter and re-enable button
      // In Very Hard mode, just select the cell instead of removing (allows editing)
      if (isValidPosition && cell.classList.contains('player-placed') && state.grid[row][col] !== ' ') {
        if (isVeryHardMode()) {
          // In Very Hard mode, select the cell for editing
          if (state.selectedCell) {
            state.selectedCell.classList.remove('highlighted');
          }

          // Always remove any existing highlighted class from all cells
          const allCells = elements.gridboard.getElementsByTagName('td');
          Array.from(allCells).forEach(c => c.classList.remove('highlighted'));

          cell.classList.add('highlighted');
          state.selectedCell = cell;

          // Focus the hidden input
          const hiddenInput = document.getElementById('veryhard-keyboard-input');
          if (hiddenInput) {
            hiddenInput.focus();
          }
        } else {
          // Normal mode: remove the letter
          // Get the letter from the cell
          const letter = state.grid[row][col];

          // Find and re-enable the corresponding letter button
          Object.values(elements.letterButtons).forEach(button => {
            if (button.textContent === letter) {
              button.disabled = false;
            }
          });

          // Reset the cell
          state.grid[row][col] = ' ';
          cell.textContent = ' ';
          cell.classList.remove('player-placed', 'correct');
          cell.classList.add('empty-cell');
          cell.style.removeProperty('color');

          // Update game state
          state.filledPositions--;
          updateLetterButtonStates();
        }
        return;
      }

      if (isValidPosition) {
        // Remove highlight from previously selected cell
        if (state.selectedCell) {
          state.selectedCell.classList.remove('highlighted');
        }

        // Always remove any existing highlighted class from all cells
        const allCells = elements.gridboard.getElementsByTagName('td');
        Array.from(allCells).forEach(c => c.classList.remove('highlighted'));

        // Add highlight to newly selected cell
        cell.classList.add('highlighted');
        state.selectedCell = cell;

        // In Very Hard mode, focus the hidden input to activate keyboard
        if (isVeryHardMode()) {
          const hiddenInput = document.getElementById('veryhard-keyboard-input');
          if (hiddenInput) {
            hiddenInput.focus();
          }
        }
      }
    }
  });

  // Letter button click handlers
  Object.values(elements.letterButtons).forEach(button => {
    button.addEventListener('click', () => {
      if (state.selectedCell) {
        const rowIndex = parseInt(state.selectedCell.dataset.row);
        const cellIndex = parseInt(state.selectedCell.dataset.col);

        // Update the cell with new letter
        state.selectedCell.textContent = button.textContent;
        state.selectedCell.style.removeProperty('color');
        state.selectedCell.classList.remove('correct');
        state.selectedCell.classList.add('player-placed');
        state.grid[rowIndex][cellIndex] = button.textContent;
        state.selectedCell.classList.remove('empty-cell');
        state.selectedCell.classList.remove('highlighted');
        state.selectedCell = null;

        // Recalculate filled positions
        state.filledPositions = countFilledPositions();

        // Update letter button states considering repeat letters
        updateLetterButtonStates();

        if (state.filledPositions === 5) {
          if (isVeryHardMode()) {
            checkVeryHardWinCondition();
          } else {
            checkWinCondition();
          }
        }
      }
    });
  });
}
// Update CSS styles to show that placed letters are clickable
function addLetterRemovalStyles() {
  const style = document.createElement('style');
  style.textContent = `
    .player-placed {
      cursor: pointer;
      position: relative;  /* For z-index to work */
      z-index: 1;         /* Ensure hover effect shows above other styles */
      transition: all 0.2s ease;
    }

    .player-placed:hover {
      background-color: #ffe6e6 !important;  /* Light red background on hover */
      border-color: #ff9999 !important;      /* Slightly darker border on hover */
    }

    /* Style for empty cells that can accept letters */
    .empty-cell {
      background-color: white !important;
      cursor: pointer;
    }

    .empty-cell:hover {
      background-color: #f0f0f0 !important;
    }

    /* Maintain highlighted state */
    .empty-cell.highlighted {
      background-color: #f0f0f0 !important;
      border: 2px solid #6aaa64 !important;
    }

    /* Ensure correct letters maintain their styling */
    .player-placed.correct {
      color: #4CAF50 !important;
    }

    .player-placed.correct:hover {
      background-color: #e6ffe6 !important;  /* Light green for correct letters */
      border-color: #4CAF50 !important;
    }

    /* Toggle switch styles */
    .toggle-switch input:checked + .toggle-slider {
      background-color: #22c55e;
    }

    .toggle-slider:before {
      position: absolute;
      content: "";
      height: 16px;
      width: 16px;
      left: 4px;
      bottom: 4px;
      background-color: white;
      transition: .4s;
      border-radius: 50%;
    }

    .toggle-switch input:checked + .toggle-slider:before {
      transform: translateX(26px);
    }
  `;
  document.head.appendChild(style);
}

// Function to count currently filled positions
function countFilledPositions() {
  let count = 0;
  state.locsToBlankX.forEach((row, index) => {
    const col = state.locsToBlankY[index];
    if (state.grid[row][col] !== ' ') {
      count++;
    }
  });
  return count;
}
// Update letter button states
function updateLetterButtonStates() {
  // Create a map of how many times each letter should appear
  const targetLetterCounts = {};
  state.correctWord.split('').forEach(letter => {
    targetLetterCounts[letter] = (targetLetterCounts[letter] || 0) + 1;
  });

  // Count currently placed letters
  const placedLetterCounts = {};
  state.locsToBlankX.forEach((row, index) => {
    const col = state.locsToBlankY[index];
    const letter = state.grid[row][col];
    if (letter !== ' ') {
      placedLetterCounts[letter] = (placedLetterCounts[letter] || 0) + 1;
    }
  });

  // Enable/disable buttons based on letter placement
  Object.values(elements.letterButtons).forEach(button => {
    const letter = button.textContent;
    const placedCount = placedLetterCounts[letter] || 0;
    const targetCount = targetLetterCounts[letter] || 0;
    button.disabled = placedCount >= targetCount;
  });
}
//create and display win message
function showWinMessage() {
  // Create win message element if it doesn't exist
  if (!document.getElementById('win-message')) {
    const messageDiv = document.createElement('div');
    messageDiv.id = 'win-message';
    messageDiv.style.cssText = `
      position: fixed;
      top: 25%;
      left: 50%;
      transform: translate(-50%, -50%);
      background-color: rgba(255, 255, 255, 0.9);
      padding: 20px;
      border-radius: 10px;
      box-shadow: 0 0 10px rgba(0, 0, 0, 0.3);
      font-size: 24px;
      color: #4CAF50;
      text-align: center;
      z-index: 1000;
    `;
    messageDiv.textContent = ['You are so smart!', 'You win!', 'That\'s Wordfive!'][Math.floor(Math.random() * 3)];
    document.body.appendChild(messageDiv);

    // Remove message after 3 seconds
    setTimeout(() => {
      messageDiv.remove();
    }, 3000);
  }
}
//function to check for win
// Modify the checkWinCondition function
function checkWinCondition() {
  let playerWord = '';

  // Collect letters from filled positions in order
  for (let i = 0; i < state.locsToBlankX.length; i++) {
    const row = state.locsToBlankX[i];
    const col = state.locsToBlankY[i];
    playerWord += state.grid[row][col];
  }

  // Check if player's word matches the correct word (case-insensitive)
  if (playerWord.toLowerCase() === state.correctWord.toLowerCase()) {
    // Calculate solve time
    const solveTimeSeconds = Math.floor((Date.now() - state.gameStartTime) / 1000);

    // Pause the timer
    pauseTimer();

    // Update statistics
    updateStatistics(solveTimeSeconds);

    // Highlight correct letters in green
    highlightCorrectLetters();
    // Highlight the first five words
    highlightAllWords();
    // Show win message
    showWinMessage();
  }
}

// Add new function to highlight all words
function highlightAllWords() {
  // Define colors for each word
  const colors = [
    '#FF6B6B', // Red
    '#4ECDC4', // Turquoise
    '#45B7D1', // Light Blue
    '#96CEB4', // Sage Green
    '#FFBE0B'  // Yellow
  ];

  // Highlight each word
  state.wordPositions.forEach((wordData, index) => {
    if (index < 5) { // Only highlight first 5 words
      const color = colors[index];
      wordData.positions.forEach(pos => {
        const cell = elements.gridboard.rows[pos.row].cells[pos.col];
        // Only highlight if the cell isn't a blank space
        if (state.grid[pos.row][pos.col] !== ' ') {
          cell.style.backgroundColor = color;
          cell.style.color = '#FFFFFF'; // White text for better contrast
          cell.style.transition = 'background-color 0.3s ease';
        }
      });
    }
  });
}
//highlight when all letters are correct
function highlightCorrectLetters() {
  for (let i = 0; i < state.locsToBlankX.length; i++) {
    const row = state.locsToBlankX[i];
    const col = state.locsToBlankY[i];
    const cell = elements.gridboard.rows[row].cells[col];

    // Remove any existing color style
    cell.style.removeProperty('color');

    // Add correct class instead of inline style
    cell.classList.add('correct');

    // Ensure player-placed class remains
    cell.classList.add('player-placed');
  }
}
// Add showAnswer function after the resetLetterButtons function
function showAnswer() {
  // First clear any existing letters
  resetLetterButtons();

  // Get coordinates of blank spaces
  const blankCoords = state.locsToBlankX.map((row, index) => ({
    row,
    col: state.locsToBlankY[index]
  }));

  // Get the correct letters from the sixth word
  const correctLetters = state.correctWord.split('');

  // Place each letter in its correct position
  blankCoords.forEach((coord, index) => {
    const letter = correctLetters[index];
    state.grid[coord.row][coord.col] = letter;

    // Get the cell and update its appearance
    const cell = elements.gridboard.rows[coord.row].cells[coord.col];
    cell.textContent = letter;
    cell.classList.add('player-placed');
    cell.style.color = '#808080'; // Grey color to indicate it's a revealed answer
  });

  // Update letter button states but don't enable win condition checking
  state.filledPositions = 5;
  updateLetterButtonStates();

  // Disable all letter buttons since answer is shown
  Object.values(elements.letterButtons).forEach(button => {
    button.disabled = true;
  });
}

// Give a hint by placing one correct letter
function giveHint() {
  // Get coordinates of blank spaces and correct letters
  const blankCoords = state.locsToBlankX.map((row, index) => ({
    row,
    col: state.locsToBlankY[index],
    correctLetter: state.correctWord[index]
  }));

  // Find the first blank position that doesn't have the correct letter
  let hintPosition = null;
  for (let i = 0; i < blankCoords.length; i++) {
    const coord = blankCoords[i];
    const currentLetter = state.grid[coord.row][coord.col];

    // If the cell is empty or has the wrong letter, this is where we'll place the hint
    if (currentLetter === ' ' || currentLetter !== coord.correctLetter) {
      hintPosition = coord;
      break;
    }
  }

  // If no position found (all correct), nothing to do
  if (!hintPosition) {
    return;
  }

  // If the position has a wrong letter, remove it first
  const currentLetter = state.grid[hintPosition.row][hintPosition.col];
  if (currentLetter !== ' ') {
    // Clear just this cell (remove the wrong letter)
    state.grid[hintPosition.row][hintPosition.col] = ' ';
    const cellToClear = elements.gridboard.rows[hintPosition.row].cells[hintPosition.col];
    cellToClear.textContent = ' ';
    cellToClear.classList.remove('player-placed', 'correct');
    cellToClear.classList.add('empty-cell');
    cellToClear.style.removeProperty('color');

    // Re-enable the button that had this wrong letter
    const buttonToEnable = Object.values(elements.letterButtons).find(button =>
      button.textContent === currentLetter && button.disabled
    );
    if (buttonToEnable) {
      buttonToEnable.disabled = false;
    }
  }

  // Check if the hint letter is already placed elsewhere (in wrong position)
  // and remove it to prevent duplicates
  for (let i = 0; i < blankCoords.length; i++) {
    const coord = blankCoords[i];
    const placedLetter = state.grid[coord.row][coord.col];

    // Skip the hint position itself
    if (coord.row === hintPosition.row && coord.col === hintPosition.col) {
      continue;
    }

    // If this letter matches the hint letter and it's in the wrong spot, remove it
    if (placedLetter === hintPosition.correctLetter && placedLetter !== coord.correctLetter) {
      // Clear this cell
      state.grid[coord.row][coord.col] = ' ';
      const cellToRemove = elements.gridboard.rows[coord.row].cells[coord.col];
      cellToRemove.textContent = ' ';
      cellToRemove.classList.remove('player-placed', 'correct');
      cellToRemove.classList.add('empty-cell');
      cellToRemove.style.removeProperty('color');

      // Re-enable the button with this letter
      const buttonToEnable = Object.values(elements.letterButtons).find(button =>
        button.textContent === placedLetter && button.disabled
      );
      if (buttonToEnable) {
        buttonToEnable.disabled = false;
      }

      break; // Only remove one instance
    }
  }

  // Place the correct letter in the hint position
  state.grid[hintPosition.row][hintPosition.col] = hintPosition.correctLetter;

  // Get the cell and update its appearance
  const cell = elements.gridboard.rows[hintPosition.row].cells[hintPosition.col];
  cell.textContent = hintPosition.correctLetter;
  cell.classList.remove('empty-cell');
  cell.classList.add('player-placed');
  cell.style.color = '#0000FF'; // Blue color like regular player-placed letters

  // Disable one button with this letter (for double letter handling)
  const buttonToDisable = Object.values(elements.letterButtons).find(button =>
    button.textContent === hintPosition.correctLetter && !button.disabled
  );
  if (buttonToDisable) {
    buttonToDisable.disabled = true;
  }

  // Update filled positions count
  state.filledPositions = countFilledPositions();

  // Update letter button states
  updateLetterButtonStates();

  // Check if puzzle is complete
  if (state.filledPositions === 5) {
    if (isVeryHardMode()) {
      checkVeryHardWinCondition();
    } else {
      checkWinCondition();
    }
  }
}

// Very Hard mode functions

// Check if current difficulty is Very Hard
function isVeryHardMode() {
  return getDifficulty() === 'veryhard';
}

// Update letter button visibility based on difficulty
function updateLetterButtonVisibility() {
  const letterButtonsContainer = document.querySelector('.letter-buttons');
  if (letterButtonsContainer) {
    if (isVeryHardMode()) {
      letterButtonsContainer.style.display = 'none';
    } else {
      letterButtonsContainer.style.display = 'flex';
    }
  }
}

// Show Very Hard mode explainer popup
function showVeryHardExplainer() {
  // Remove existing explainer if present
  const existingExplainer = document.getElementById('veryhard-explainer');
  if (existingExplainer) {
    existingExplainer.remove();
  }

  const modal = document.createElement('div');
  modal.id = 'veryhard-explainer';
  modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: rgba(0, 0, 0, 0.8);
    z-index: 200;
    display: flex;
    align-items: center;
    justify-content: center;
  `;

  modal.innerHTML = `
    <div style="
      background: white;
      padding: 24px;
      border-radius: 12px;
      max-width: 350px;
      width: 90%;
      text-align: center;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
    ">
      <h3 style="margin: 0 0 16px 0; font-size: 20px; font-weight: bold; color: #333;">Welcome to Very Hard Mode!</h3>
      <p style="margin: 0 0 24px 0; color: #555; font-size: 15px; line-height: 1.6; text-align: left;">
        In this mode, you are not given letters. Instead, click on an empty square and type any letter. The five letters you enter must form a valid five-letter word, and the grid must contain 5 valid five-letter words. Good luck!
      </p>
      <button id="veryhard-explainer-button" style="
        width: 100%;
        padding: 14px;
        background-color: #10B981;
        color: white;
        border: none;
        border-radius: 8px;
        font-size: 16px;
        font-weight: 600;
        cursor: pointer;
        text-transform: uppercase;
      ">Let's Play!</button>
    </div>
  `;

  document.body.appendChild(modal);

  // Dismiss button
  document.getElementById('veryhard-explainer-button').addEventListener('click', () => {
    modal.remove();
  });
}

// Create hidden input for keyboard in Very Hard mode
function createHiddenKeyboardInput() {
  let input = document.getElementById('veryhard-keyboard-input');
  if (!input) {
    input = document.createElement('input');
    input.type = 'text';
    input.id = 'veryhard-keyboard-input';
    input.autocomplete = 'off';
    input.autocapitalize = 'characters';
    input.style.cssText = 'position: absolute; left: -9999px; top: 0; opacity: 0; width: 1px; height: 1px;';
    document.body.appendChild(input);

    // Handle input from keyboard
    input.addEventListener('input', (e) => {
      const letter = e.target.value.toUpperCase();
      e.target.value = ''; // Clear input immediately

      if (letter && /^[A-Z]$/.test(letter) && state.selectedCell) {
        placeLetterInVeryHardMode(letter);
      }
    });

    // Handle backspace
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace' && state.selectedCell) {
        e.preventDefault();
        removeLetterInVeryHardMode();
      }
    });
  }
  return input;
}

// Place a letter in the selected cell for Very Hard mode
function placeLetterInVeryHardMode(letter) {
  if (!state.selectedCell) return;

  const cell = state.selectedCell;
  const row = parseInt(cell.dataset.row);
  const col = parseInt(cell.dataset.col);

  // Check if this is a valid position
  const isValidPosition = state.locsToBlankX.some((x, i) =>
    x === row && state.locsToBlankY[i] === col
  );

  if (!isValidPosition) return;

  // Check if this is an empty cell or a filled cell we can replace
  const isEmpty = cell.classList.contains('empty-cell');
  const isFilled = cell.classList.contains('player-placed');

  if (!isEmpty && !isFilled) return;

  // Update grid state
  state.grid[row][col] = letter;

  // Update cell display
  cell.textContent = letter;
  cell.classList.remove('highlighted', 'empty-cell');
  cell.classList.add('player-placed');
  cell.style.color = 'red';

  // Clear selection
  state.selectedCell = null;

  // Recalculate filled positions
  state.filledPositions = countFilledPositions();

  // Check win condition when all 5 letters are placed
  if (state.filledPositions === 5) {
    checkVeryHardWinCondition();
  }
}

// Remove a letter from the selected cell for Very Hard mode
function removeLetterInVeryHardMode() {
  if (!state.selectedCell) return;

  const cell = state.selectedCell;
  const row = parseInt(cell.dataset.row);
  const col = parseInt(cell.dataset.col);

  // Check if this cell has a player-placed letter
  if (!cell.classList.contains('player-placed')) return;

  // Reset the cell
  state.grid[row][col] = ' ';
  cell.textContent = ' ';
  cell.classList.remove('player-placed', 'correct');
  cell.classList.add('empty-cell');
  cell.style.removeProperty('color');

  // Keep the cell selected/highlighted for further input
  cell.classList.add('highlighted');

  // Update game state
  state.filledPositions--;
}

// Extract a word from the grid based on type and index
function getGridWord(type, index) {
  let word = '';
  if (type === 'row') {
    for (let col = 0; col < 5; col++) {
      word += state.grid[index][col];
    }
  } else if (type === 'col') {
    for (let row = 0; row < 5; row++) {
      word += state.grid[row][index];
    }
  } else if (type === 'diag1') {
    // Top-left to bottom-right diagonal
    for (let i = 0; i < 5; i++) {
      word += state.grid[i][i];
    }
  } else if (type === 'diag2') {
    // Bottom-left to top-right diagonal
    for (let i = 0; i < 5; i++) {
      word += state.grid[4 - i][i];
    }
  }
  return word;
}

// Get positions of cells for a word
function getWordPositions(type, index) {
  const positions = [];
  if (type === 'row') {
    for (let col = 0; col < 5; col++) {
      positions.push({ row: index, col: col });
    }
  } else if (type === 'col') {
    for (let row = 0; row < 5; row++) {
      positions.push({ row: row, col: index });
    }
  } else if (type === 'diag1') {
    for (let i = 0; i < 5; i++) {
      positions.push({ row: i, col: i });
    }
  } else if (type === 'diag2') {
    for (let i = 0; i < 5; i++) {
      positions.push({ row: 4 - i, col: i });
    }
  }
  return positions;
}

// Check if a word is valid in the full word list
function isValidFullWord(word) {
  return wordListFull.includes(word.toLowerCase());
}

// Check if letters can form any valid word (in any order)
function canFormValidWord(letters) {
  const sortedLetters = letters.toLowerCase().split('').sort().join('');
  return wordListFull.some(word => {
    const sortedWord = word.split('').sort().join('');
    return sortedWord === sortedLetters;
  });
}

// Find the valid word that can be formed from the given letters (in any order)
function findWordFromLetters(letters) {
  const sortedLetters = letters.toLowerCase().split('').sort().join('');
  return wordListFull.find(word => {
    const sortedWord = word.split('').sort().join('');
    return sortedWord === sortedLetters;
  });
}

// Display the word formed by the player's letters below the grid
function showPlayerWordDisplay(word) {
  // Remove existing display if present
  const existingDisplay = document.getElementById('player-word-display');
  if (existingDisplay) {
    existingDisplay.remove();
  }

  const display = document.createElement('div');
  display.id = 'player-word-display';
  display.style.cssText = `
    text-align: center;
    font-size: 18px;
    font-weight: bold;
    color: #006400;
    margin-top: 10px;
    padding: 8px 16px;
    background-color: #f0fff0;
    border-radius: 8px;
    border: 2px solid #006400;
  `;
  display.innerHTML = `Your word: <span style="font-size: 22px; letter-spacing: 2px;">${word}</span>`;

  // Insert after the game board
  const boardWrapper = document.querySelector('.board-wrapper');
  if (boardWrapper) {
    boardWrapper.insertAdjacentElement('afterend', display);
  }
}

// Highlight the valid words found in Very Hard mode
function highlightVeryHardWords(wordsToHighlight) {
  // Define colors for each word
  const colors = [
    '#FF6B6B', // Red
    '#4ECDC4', // Turquoise
    '#45B7D1', // Light Blue
    '#96CEB4', // Sage Green
    '#FFBE0B'  // Yellow
  ];

  wordsToHighlight.forEach((wordInfo, index) => {
    const positions = getWordPositions(wordInfo.type, wordInfo.index);
    const color = colors[index % colors.length];

    positions.forEach(pos => {
      const cell = elements.gridboard.querySelector(`td[data-row="${pos.row}"][data-col="${pos.col}"]`);
      if (cell) {
        cell.style.backgroundColor = color;
        cell.style.color = '#FFFFFF'; // White text for better contrast
        cell.style.transition = 'background-color 0.3s ease';
      }
    });
  });
}

// Check win condition for Very Hard mode
function checkVeryHardWinCondition() {
  // First, check if the entered letters can form a valid word (in any order)
  let enteredLetters = '';
  for (let i = 0; i < state.locsToBlankX.length; i++) {
    const row = state.locsToBlankX[i];
    const col = state.locsToBlankY[i];
    enteredLetters += state.grid[row][col];
  }

  if (!canFormValidWord(enteredLetters)) {
    showToast('Entered letters must form a valid 5-letter word!');
    return;
  }

  const validWords = [];
  const seenWords = new Set();

  // Check all rows
  for (let row = 0; row < 5; row++) {
    const word = getGridWord('row', row);
    if (isValidFullWord(word) && !seenWords.has(word)) {
      seenWords.add(word);
      validWords.push({ type: 'row', index: row, word: word });
    }
  }

  // Check all columns
  for (let col = 0; col < 5; col++) {
    const word = getGridWord('col', col);
    if (isValidFullWord(word) && !seenWords.has(word)) {
      seenWords.add(word);
      validWords.push({ type: 'col', index: col, word: word });
    }
  }

  // Check diagonal 1 (top-left to bottom-right)
  const diag1Word = getGridWord('diag1', 0);
  if (isValidFullWord(diag1Word) && !seenWords.has(diag1Word)) {
    seenWords.add(diag1Word);
    validWords.push({ type: 'diag1', index: 0, word: diag1Word });
  }

  // Check diagonal 2 (bottom-left to top-right)
  const diag2Word = getGridWord('diag2', 0);
  if (isValidFullWord(diag2Word) && !seenWords.has(diag2Word)) {
    seenWords.add(diag2Word);
    validWords.push({ type: 'diag2', index: 0, word: diag2Word });
  }

  // Check if we have at least 5 valid unique words
  if (validWords.length >= 5) {
    // Take the first 5 valid words
    const wordsToHighlight = validWords.slice(0, 5);

    // Calculate solve time
    const solveTimeSeconds = Math.floor((Date.now() - state.gameStartTime) / 1000);

    // Pause the timer
    pauseTimer();

    // Clear any selections
    if (state.selectedCell) {
      state.selectedCell.classList.remove('highlighted');
      state.selectedCell = null;
    }

    // Update statistics
    updateStatistics(solveTimeSeconds);

    // Highlight the valid words
    highlightVeryHardWords(wordsToHighlight);

    // Show win message
    showWinMessage();

    // Display the word formed by player's letters below the grid
    const formedWord = findWordFromLetters(enteredLetters);
    if (formedWord) {
      showPlayerWordDisplay(formedWord.toUpperCase());
    }
  } else {
    // Not enough valid words - show error toast
    showToast('Could not find 5 valid words!');
  }
}

// Reset letter buttons and clear player placed letters
function resetLetterButtons() {
  // Existing reset code stays the same
  if (state.selectedCell) {
    state.selectedCell.classList.remove('highlighted');
    state.selectedCell = null;
  }

  for (let row = 0; row < 5; row++) {
    for (let col = 0; col < 5; col++) {
      const cell = elements.gridboard.rows[row].cells[col];
      cell.style.backgroundColor = '';
      cell.classList.remove('player-placed', 'correct');
      cell.style.removeProperty('color');
    }
  }

  for (let i = 0; i < state.locsToBlankX.length; i++) {
    const row = state.locsToBlankX[i];
    const col = state.locsToBlankY[i];
    state.grid[row][col] = ' ';
  }

  updateGridDisplay();
  state.filledPositions = 0;

  // Reset game start time
  state.gameStartTime = Date.now();

  // Reset and resume timer
  resetTimer();
  resumeTimer();

  // Re-enable all letter buttons
  Object.values(elements.letterButtons).forEach(button => {
    button.disabled = false;
  });

  updateLetterButtonStates();

  const winMessage = document.getElementById('win-message');
  if (winMessage) {
    winMessage.remove();
  }

  // Remove player word display if present (from Very Hard mode)
  const playerWordDisplay = document.getElementById('player-word-display');
  if (playerWordDisplay) {
    playerWordDisplay.remove();
  }

  // Update letter button visibility (for Very Hard mode)
  updateLetterButtonVisibility();
}

// Add this function to track word positions during placement
function trackWordPosition(word, startRow, startCol, direction) {
  const positions = [];
  const letters = word.split('');

  letters.forEach((_, index) => {
    let pos;
    switch(direction) {
      case 'horz':
        pos = { row: startRow, col: index };
        break;
      case 'vert':
        pos = { row: index, col: startCol };
        break;
      case 'diag':
        pos = { row: index, col: index };
        break;
      case 'diagup':
        pos = { row: 4-index, col: index };
        break;
    }
    positions.push(pos);
  });

  state.wordPositions.push({ word, positions });
}
// Modify placeWord function to track positions
function placeWord(word, startRow, startCol, direction) {
  const letters = word.split('');
  let n = -1;

  letters.forEach(letter => {
    n++;
    switch(direction) {
      case 'horz':
        state.grid[startRow][n] = letter;
        break;
      case 'vert':
        state.grid[n][startCol] = letter;
        break;
      case 'diag':
        state.grid[n][n] = letter;
        break;
      case 'diagup':
        state.grid[4-n][n] = letter;
        break;
    }
  });

  // Track the word positions
  trackWordPosition(word, startRow, startCol, direction);
}

function placeInitialWords() {
  // Place first word
  placeFirstWord();

  // Place words 2-5
  while (state.finalWordCount < 5) {
    placeNextWord();
  }
}

function placeFirstWord() {
  // Pick random word and get starting position
  const word1 = state.wordList[Math.floor(Math.random() * state.wordList.length)];
  const [stsqRow, stsqCol] = getStartingPosition();

  // Determine placement direction and place word
  if (stsqRow === 0 && stsqCol === 0) {
    const direction = ['vert', 'horz', 'diag'][Math.floor(Math.random() * 3)];
    placeWord(word1, stsqRow, stsqCol, direction);
  } 
  else if (stsqRow === 4 && stsqCol === 0) {
    const direction = ['horz', 'diagup'][Math.floor(Math.random() * 2)];
    placeWord(word1, stsqRow, stsqCol, direction);
  }
  else if (stsqRow === 0) {
    placeWord(word1, stsqRow, stsqCol, 'vert');
  }
  else {
    placeWord(word1, stsqRow, stsqCol, 'horz');
  }

  // Update game state
  state.finalWordList.push(word1);
  state.stsqRowList.push(stsqRow);
  state.stsqColList.push(stsqCol);
  state.wordList = state.wordList.filter(w => w !== word1);
  state.finalWordCount = 1;
}

// Modify placeNextWord function to properly handle diagonals
function placeNextWord() {
  // Get new starting position
  const [stsqRow, stsqCol] = getStartingPosition();

  // Get all possible patterns based on position
  const patterns = getPossiblePatterns(stsqRow, stsqCol);

  // Try each pattern until we find a valid word placement
  for (const {pattern, direction} of patterns) {
    if (!pattern.includes('_')) {
      continue; // Skip if no empty spaces
    }

    if (pattern.every(cell => cell === '_')) {
      // Empty row/column/diagonal - place random word
      const word = state.wordList[Math.floor(Math.random() * state.wordList.length)];
      placeWordInPosition(word, stsqRow, stsqCol, direction);
      updateGameState(word, stsqRow, stsqCol);
      return;
    } else {
      // Find word matching partial pattern
      const candidates = findMatchingWords(pattern);
      if (candidates.length > 0) {
        const word = candidates[Math.floor(Math.random() * candidates.length)];
        placeWordInPosition(word, stsqRow, stsqCol, direction);
        updateGameState(word, stsqRow, stsqCol);
        return;
      }
    }
  }
}
// New function to get all possible patterns for a position
function getPossiblePatterns(row, col) {
  if (row === 0 && col === 0) {
    return [
      {
        pattern: [state.grid[0][0], state.grid[1][0], state.grid[2][0], state.grid[3][0], state.grid[4][0]],
        direction: 'vert'
      },
      {
        pattern: [state.grid[0][0], state.grid[0][1], state.grid[0][2], state.grid[0][3], state.grid[0][4]],
        direction: 'horz'
      },
      {
        pattern: [state.grid[0][0], state.grid[1][1], state.grid[2][2], state.grid[3][3], state.grid[4][4]],
        direction: 'diag'
      }
    ];
  } 
  else if (row === 4 && col === 0) {
    return [
      {
        pattern: [state.grid[4][0], state.grid[4][1], state.grid[4][2], state.grid[4][3], state.grid[4][4]],
        direction: 'horz'
      },
      {
        pattern: [state.grid[4][0], state.grid[3][1], state.grid[2][2], state.grid[1][3], state.grid[0][4]],
        direction: 'diagup'
      }
    ];
  }
  else if (row === 0) {
    return [{
      pattern: [state.grid[0][col], state.grid[1][col], state.grid[2][col], state.grid[3][col], state.grid[4][col]],
      direction: 'vert'
    }];
  }
  else {
    return [{
      pattern: [state.grid[row][0], state.grid[row][1], state.grid[row][2], state.grid[row][3], state.grid[row][4]],
      direction: 'horz'
    }];
  }
}

function getStartingPosition() {
  // Random start from top row or first column
  const isTopRow = Math.random() < 0.5;
  if (isTopRow) {
    return [0, Math.floor(Math.random() * 5)];
  } else {
    return [Math.floor(Math.random() * 5), 0];
  }
}

function getPartialWord(row, col) {
  const patterns = getPossiblePatterns(row, col);
  const randomPattern = patterns[Math.floor(Math.random() * patterns.length)];
  return randomPattern.pattern;
}

function findMatchingWords(partial) {
  // Find positions of existing letters
  const letterPositions = partial.reduce((positions, letter, index) => {
    if (letter !== '_') {
      positions.push(index);
    }
    return positions;
  }, []);

  // Find words that match the pattern
  return state.wordList.filter(word => {
    const letters = word.split('');
    return letterPositions.every(pos => letters[pos] === partial[pos]);
  });
}

function placeWordInPosition(word, row, col, direction) {
  placeWord(word, row, col, direction);
}

function updateGameState(word, row, col) {
  state.finalWordList.push(word);
  state.stsqRowList.push(row);
  state.stsqColList.push(col);
  state.wordList = state.wordList.filter(w => w !== word);
  state.finalWordCount++;
}

// Find valid sixth word
function findSixthWord() {
  let sixWordFound = false;

  while (!sixWordFound) {
    const sixWord = state.wordList[Math.floor(Math.random() * state.wordList.length)];
    const sixWordLetters = sixWord.split('');
    let letterMatchCount = 0;

    // Check if letters exist in grid
    for (const letter of sixWordLetters) {
      const letterCount = sixWordLetters.filter(l => l === letter).length;
      let letterInGridCount = 0;

      state.grid.forEach(row => {
        letterInGridCount += row.filter(l => l === letter).length;
      });

      if (letterInGridCount >= letterCount) {
        letterMatchCount++;
      }
    }

    if (letterMatchCount === 5) {
      const skipBack = processLetterLocations(sixWordLetters);

      if (!skipBack) {
        removeLettersFromGrid();
        updateLetterButtons(sixWordLetters);
        state.finalWordList.push(sixWord);
        sixWordFound = true;
        console.log(state.finalWordList)
        console.log(state.locsToBlankX)
        console.log(state.locsToBlankY)
      }
    }
  }
}

// Process letter locations for sixth word
function processLetterLocations(letters) {
  state.locsToBlankX = [];
  state.locsToBlankY = [];

  for (const letter of letters) {
    const positions = findLetterPositions(letter);
    if (!positions) return true;

    state.locsToBlankX.push(positions.row);
    state.locsToBlankY.push(positions.col);
  }

  return checkTooManyBlanks();
}

// Find positions of a letter in grid
function findLetterPositions(letter) {
  const positions = [];

  for (let row = 0; row < 5; row++) {
    for (let col = 0; col < 5; col++) {
      if (state.grid[row][col] === letter) {
        if (!isPositionUsed(row, col)) {
          positions.push({row, col});
        }
      }
    }
  }

  if (positions.length === 0) return null;
  const randomIndex = Math.floor(Math.random() * positions.length);
  return positions[randomIndex];
}

// Check if position is already used
function isPositionUsed(row, col) {
  return state.locsToBlankX.some((x, i) => 
    x === row && state.locsToBlankY[i] === col
  );
}

// Check if too many blanks in row/column
function checkTooManyBlanks() {
  const rowCounts = {};
  const colCounts = {};

  state.locsToBlankX.forEach((row, i) => {
    const col = state.locsToBlankY[i];
    rowCounts[row] = (rowCounts[row] || 0) + 1;
    colCounts[col] = (colCounts[col] || 0) + 1;
  });

  return Object.values(rowCounts).some(count => count > 2) ||
         Object.values(colCounts).some(count => count > 2);
}

// Remove letters from grid for sixth word
function removeLettersFromGrid() {
  for (let i = 0; i < 5; i++) {
    const row = state.locsToBlankX[i];
    const col = state.locsToBlankY[i];
    state.lettersRemoved.push(state.grid[row][col]);
    state.grid[row][col] = ' ';
  }
}

// Update letter buttons with sixth word letters
function updateLetterButtons(letters) {
  Object.values(elements.letterButtons).forEach((button, i) => {
    button.textContent = letters[i];
  });
  state.correctWord = letters.join('');
  state.filledPositions = 0;
}

// Fill remaining spaces with random letters
function fillRemainingSpaces() {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz';
  for (let x = 0; x < 5; x++) {
    for (let y = 0; y < 5; y++) {
      if (state.grid[x][y] === '_') {
        state.grid[x][y] = alphabet[Math.floor(Math.random() * alphabet.length)];
      }
    }
  }
  updateGridDisplay();
}

// Initialize game
async function initializeGame() {
  // Create empty grid first
  createEmptyGrid();
  // Get the appropriate word list based on difficulty
  const currentWordList = getCurrentWordList();
  // Reset state
  Object.assign(state, {
    grid: Array(5).fill().map(() => Array(5).fill('_')),
    finalWordList: [],
    stsqRowList: [],
    stsqColList: [],
    finalWordCount: 0,
    wordPositions: [],
    selectedCell: null,
    locsToBlankX: [],
    locsToBlankY: [],
    lettersRemoved: [],
    correctWord: '',
    filledPositions: 0,
    wordList: [...currentWordList],
    gameStartTime: Date.now() // Set game start time
  });

  // Place initial words
  placeInitialWords();

  // Find and place sixth word
  findSixthWord();

  // Fill remaining spaces
  fillRemainingSpaces();

  // Update display
  updateGridDisplay();
  setupLetterButtons();
  addLetterRemovalStyles();

  // Reset and resume timer for the new puzzle
  resetTimer();
  resumeTimer();

  // Update letter button visibility based on difficulty
  updateLetterButtonVisibility();
}
// Event Listeners
elements.newPuzzleButton.addEventListener('click', () => {
  state.selectedCell = null;
  initializeGame();
  resetLetterButtons();
});

elements.resetButton.addEventListener('click', resetLetterButtons);
elements.hintButton.addEventListener('click', giveHint);
elements.showAnswerButton.addEventListener('click', showAnswer);

// Call the main function to initialize
initializeGame();

// Create hidden input for Very Hard mode keyboard
createHiddenKeyboardInput();

// Create and append help modal to document
function createHelpModal() {
  // Create container for help button and modal
  const helpContainer = document.createElement('div');
  helpContainer.id = 'help-container';
  // Find the header element
  const header = document.querySelector('.game-header');
  if (header) {
    header.appendChild(helpContainer);
  }

  // Create help button
  const helpButton = document.createElement('button');
  helpButton.id = 'help-button';
  helpButton.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="10"></circle>
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
      <line x1="12" y1="17" x2="12.01" y2="17"></line>
    </svg>
  `;
  helpContainer.appendChild(helpButton);

  // Create modal
  const modal = document.createElement('div');
  modal.id = 'help-modal';
  modal.className = 'hidden fixed inset-0 bg-black bg-opacity-50 z-40';
  modal.innerHTML = `
    <div class="fixed inset-0 flex items-center justify-center p-4">
      <div class="bg-white rounded-lg p-6 max-w-md w-full max-h-[90vh] overflow-y-auto relative">
        <h2 class="text-xl font-bold mb-4">How to Play Wordfive</h2>
        <div class="space-y-4">
          <p>
            Wordfive is a bit like word search meets sudoku. 
          </p>
          <br>
          <p>
            You have to find how the letters below the grid fit back into the blank spaces such that there are 5 five-letter words in the grid.
          </p>

          <div>
            <h3 class="font-bold mb-2">Game Rules:</h3>
            <ul class="list-disc pl-5 space-y-2">
              <li>The grid contains 5 five-letter words placed horizontally, vertically, or diagonally.</li>
              <li>Five letters have been removed from these words, creating empty spaces.</li>
              <li>These removed letters form a 6th five-letter word.</li>
              <li>Your goal is to fit the letters back into the grid by placing the provided letters in the correct empty spaces to recreate the complete grid with 5 five-letter words.</li>
            </ul>
          </div>

          <div>
            <h3 class="font-bold mb-2">How to Play:</h3>
            <ol class="list-decimal pl-5 space-y-2">
              <li>Click on any empty space in the grid.</li>
              <li>Click a letter button to place that letter in the selected space.</li>
              <li>Continue until you've placed all five letters.</li>
              <li>If the grid contains five 5-letter words, you win!</li>
            </ol>
          </div>

          <div>
            <h3 class="font-bold mb-2">Controls:</h3>
            <ul class="list-disc pl-5 space-y-2">
              <li><strong>Reset:</strong> Clear your placed letters to try again.</li>
              <li><strong>Hint:</strong> Places one correct letter in the grid. If the position has an incorrect letter, it will be replaced with the correct one.</li>
              <li><strong>New Puzzle:</strong> Start a completely new puzzle.</li>
              <li><strong>Show Answer:</strong> Show the correct answer to the puzzle.</li>
            </ul>
          </div>
          <div class="space-y-4">
            <p>
              Questions? Issues? Contact paul@playwordfive.com.
            </p>
          <div>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  // Stop propagation on modal content to prevent closing when clicking inside
  const modalContent = modal.querySelector('.bg-white');
  modalContent.addEventListener('click', (e) => {
    e.stopPropagation();
  });

  // Add event listeners
  helpButton.addEventListener('click', (e) => {
    e.stopPropagation();
    const modal = document.getElementById('help-modal');
    modal.classList.remove('hidden');
  });

  // Click anywhere outside to close (handled globally below)
}

// Initialize help system
document.addEventListener('DOMContentLoaded', createHelpModal);

// Create and append statistics modal to document
function createStatsModal() {
  // Find the header element
  const header = document.querySelector('.game-header');
  if (!header) return;

  // Create stats button
  const statsButton = document.createElement('button');
  statsButton.id = 'stats-button';
  statsButton.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <line x1="18" y1="20" x2="18" y2="10"></line>
      <line x1="12" y1="20" x2="12" y2="4"></line>
      <line x1="6" y1="20" x2="6" y2="14"></line>
    </svg>
  `;
  header.appendChild(statsButton);

  // Create modal
  const modal = document.createElement('div');
  modal.id = 'stats-modal';
  modal.className = 'hidden fixed inset-0 bg-black bg-opacity-50 z-40';
  modal.innerHTML = `
    <div class="fixed inset-0 flex items-center justify-center p-4">
      <div class="bg-white rounded-lg p-6 max-w-md w-full max-h-[90vh] overflow-y-auto relative">
        <h2 class="text-xl font-bold mb-4">Statistics</h2>
        <div id="stats-content" class="space-y-2">
          <!-- Statistics will be populated here -->
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  // Stop propagation on modal content to prevent closing when clicking inside
  const modalContent = modal.querySelector('.bg-white');
  modalContent.addEventListener('click', (e) => {
    e.stopPropagation();
  });

  // Add event listeners
  statsButton.addEventListener('click', (e) => {
    e.stopPropagation();
    updateStatsDisplay();
    const modal = document.getElementById('stats-modal');
    modal.classList.remove('hidden');
  });

}

// Global click handler to close modals when clicking outside
document.addEventListener('click', () => {
  const helpModal = document.getElementById('help-modal');
  const statsModal = document.getElementById('stats-modal');

  if (helpModal && !helpModal.classList.contains('hidden')) {
    helpModal.classList.add('hidden');
  }
  if (statsModal && !statsModal.classList.contains('hidden')) {
    statsModal.classList.add('hidden');
  }
});

// Update statistics display
function updateStatsDisplay() {
  const stats = getStatistics();
  const statsContent = document.getElementById('stats-content');

  if (!statsContent) return;

  // Calculate average solve time
  const avgSolveTime = stats.puzzlesSolved > 0
    ? stats.totalSolveTime / stats.puzzlesSolved
    : null;

  const currentDifficulty = getDifficulty();

  statsContent.innerHTML = `
    <div class="stat-item">
      <div class="stat-label">Puzzles Solved</div>
      <div class="stat-value">${stats.puzzlesSolved}</div>
    </div>
    <div class="stat-item">
      <div class="stat-label">Average Solve Time</div>
      <div class="stat-value">${formatTime(avgSolveTime)}</div>
    </div>
    <div class="stat-item">
      <div class="stat-label">Shortest Solve Time</div>
      <div class="stat-value">${formatTime(stats.shortestSolveTime)}</div>
    </div>
    <div class="stat-item" style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
      <div class="stat-label">Puzzle Difficulty</div>
      <select id="difficulty-select" class="difficulty-select" style="width: 100%; padding: 8px; border: 1px solid #d1d5db; border-radius: 4px; font-size: 14px; margin-top: 8px;">
        <option value="easy" ${currentDifficulty === 'easy' ? 'selected' : ''}>Easy (500 words)</option>
        <option value="medium" ${currentDifficulty === 'medium' ? 'selected' : ''}>Medium (1000 words)</option>
        <option value="hard" ${currentDifficulty === 'hard' ? 'selected' : ''}>Hard (3500+ words)</option>
        <option value="veryhard" ${currentDifficulty === 'veryhard' ? 'selected' : ''}>Very Hard (no letters given)</option>
      </select>
    </div>
    <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 15px;">
        <label for="timer-toggle" style="font-size: 14px; font-weight: 500; color: #333;">Show Timer</label>
        <label class="toggle-switch" style="position: relative; display: inline-block; width: 50px; height: 24px;">
          <input type="checkbox" id="timer-toggle" style="opacity: 0; width: 0; height: 0;">
          <span class="toggle-slider" style="position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: #ccc; transition: .4s; border-radius: 24px;"></span>
        </label>
      </div>
    </div>
    <div style="margin-top: 20px;">
      <button id="reset-stats-button" style="width: 100%; padding: 10px; background-color: #ef4444; color: white; border: none; border-radius: 4px; font-size: 14px; cursor: pointer; font-weight: 500;">
        Reset Statistics
      </button>
    </div>
  `;

  // Add event listener for difficulty change
  const difficultySelect = document.getElementById('difficulty-select');
  if (difficultySelect) {
    difficultySelect.addEventListener('change', (e) => {
      const newDifficulty = e.target.value;
      saveDifficulty(newDifficulty);
      // Show a message that the change will take effect on next puzzle
      alert('Difficulty changed! Start a new puzzle to use the selected difficulty.');

      // Show Very Hard mode explainer if selected
      if (newDifficulty === 'veryhard') {
        showVeryHardExplainer();
      }
    });
  }

  // Add event listener for reset stats button
  const resetStatsButton = document.getElementById('reset-stats-button');
  if (resetStatsButton) {
    resetStatsButton.addEventListener('click', (e) => {
      e.stopPropagation();
      if (confirm('Are you sure you want to reset all statistics? This action cannot be undone.')) {
        resetStatistics();
        updateStatsDisplay();
      }
    });
  }

  // Add event listener for timer toggle
  const timerToggle = document.getElementById('timer-toggle');
  if (timerToggle) {
    // Set initial state
    timerToggle.checked = getTimerVisibility();

    timerToggle.addEventListener('change', (e) => {
      e.stopPropagation();
      const isVisible = e.target.checked;
      saveTimerVisibility(isVisible);
      updateTimerDisplay();
    });
  }
}

// Initialize statistics system
document.addEventListener('DOMContentLoaded', createStatsModal);

// Initialize timer display
document.addEventListener('DOMContentLoaded', () => {
  updateTimerDisplay();
});

// Add share button to DOM after control buttons
function addShareButton() {
    const controlButtons = document.querySelector('.control-buttons');
    const buttonContainer = document.createElement('div');
    buttonContainer.className = 'share-button-container';
    buttonContainer.style.display = 'flex'; // Make container flex to align buttons

    // Share button
    const shareButton = document.createElement('button');
    shareButton.className = 'share-button';
    shareButton.textContent = 'Share';

    // App Store Badge - Apple badge comes first per guidelines
    const appStoreLink = document.createElement('a');
    appStoreLink.href = 'https://apps.apple.com/us/app/wordfive-word-search-sudoku/id6755621635';
    appStoreLink.target = '_blank';
    appStoreLink.rel = 'noopener noreferrer';
    appStoreLink.className = 'app-store-badge-link';

    const appStoreBadge = document.createElement('img');
    appStoreBadge.src = 'Download_on_the_App_Store_Badge_US-UK_RGB_blk_092917.svg';
    appStoreBadge.alt = 'Download on the App Store';
    appStoreBadge.className = 'store-badge';

    appStoreLink.appendChild(appStoreBadge);

    // Google Play Badge
    const googlePlayLink = document.createElement('a');
    googlePlayLink.href = 'https://play.google.com/store/apps/details?id=com.playwordfive.wordfive';
    googlePlayLink.target = '_blank';
    googlePlayLink.rel = 'noopener noreferrer';
    googlePlayLink.className = 'google-play-badge-link';

    const googlePlayBadge = document.createElement('img');
    googlePlayBadge.src = 'GetItOnGooglePlay_Badge_Web_color_English.svg';
    googlePlayBadge.alt = 'Get it on Google Play';
    googlePlayBadge.className = 'store-badge';

    googlePlayLink.appendChild(googlePlayBadge);

    // Promotional text
    const promoText = document.createElement('p');
    promoText.className = 'app-promo-text';
    promoText.textContent = 'Get the FREE app for improved gameplay, more stats, unlockable colors, customizable win messages, and more!';

    // Share button container
    const shareContainer = document.createElement('div');
    shareContainer.className = 'share-container';
    shareContainer.appendChild(shareButton);

    // Add app store badges to container
    buttonContainer.appendChild(appStoreLink);
    buttonContainer.appendChild(googlePlayLink);

    // Add container after control buttons
    controlButtons.parentNode.insertBefore(buttonContainer, controlButtons.nextSibling);

    // Add promotional text after the button container
    controlButtons.parentNode.insertBefore(promoText, buttonContainer.nextSibling);

    // Add share button container after promotional text
    controlButtons.parentNode.insertBefore(shareContainer, promoText.nextSibling);

    // Add click handler for share button
    shareButton.addEventListener('click', shareGame);
}

// Share functionality
function shareGame() {
    const shareText = "Word search meets Sudoku. Try Wordfive!\n\nhttps://playwordfive.com";

    // Copy to clipboard
    navigator.clipboard.writeText(shareText)
        .then(() => showToast('Copied to clipboard!'))
        .catch(err => showToast('Failed to copy to clipboard'));
}

// Toast notification
function showToast(message) {
    // Remove existing toast if present
    const existingToast = document.querySelector('.toast');
    if (existingToast) {
        existingToast.remove();
    }

    // Create new toast
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    document.body.appendChild(toast);

    // Trigger reflow
    toast.offsetHeight;

    // Show toast
    toast.classList.add('show');

    // Hide after 2 seconds
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 2000);
}
// Call addShareButton for initial setup
document.addEventListener('DOMContentLoaded', addShareButton);
