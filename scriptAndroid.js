
// Core game state
const state = {
  grid: [],
  finalWordList: [],
  wordList: [],
  stsqRowList: [],
  stsqColList: [],
  finalWordCount: 0,
  selectedCell: null,
  selectedLetter: null, // Track which letter button is selected
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
    shortestSolveTime: null, // in seconds
    currentStreak: 0,
    highestStreak: 0,
    lastPlayedDate: null, // stored as YYYY-MM-DD string
    puzzlesCountedForAverage: 0, // separate counter for average calculation
    hasShared: false // tracks if user has shared at least once
  };

  // Check version to ensure clean stats on fresh install
  const APP_VERSION = '1.3';
  const storedVersion = localStorage.getItem('wordfive-app-version');

  // If no version stored, this is a fresh install - ensure clean slate
  if (!storedVersion) {
    localStorage.clear(); // Clear any orphaned data from previous uninstalls
    localStorage.setItem('wordfive-app-version', APP_VERSION);
    localStorage.setItem('wordfive-statistics', JSON.stringify(defaultStats));
    return defaultStats;
  }

  // Update version if changed (but keep existing stats)
  if (storedVersion !== APP_VERSION) {
    localStorage.setItem('wordfive-app-version', APP_VERSION);
  }

  const saved = localStorage.getItem('wordfive-statistics');
  if (!saved) {
    // No stats found, return defaults
    return defaultStats;
  }

  // Merge saved stats with defaults to handle new fields
  const savedStats = JSON.parse(saved);
  return { ...defaultStats, ...savedStats };
}

function saveStatistics(stats) {
  localStorage.setItem('wordfive-statistics', JSON.stringify(stats));
  syncGameStateWithAndroid(stats);
}

// Sync game state with Android for notifications
function syncGameStateWithAndroid(stats) {
  if (typeof AndroidNotification !== 'undefined' && AndroidNotification.updateGameState) {
    try {
      AndroidNotification.updateGameState(
        stats.currentStreak || 0,
        stats.lastPlayedDate || ''
      );
    } catch (error) {
      console.log('Failed to sync with Android:', error);
    }
  }
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
    shortestSolveTime: null,
    currentStreak: 0,
    highestStreak: 0,
    lastPlayedDate: null,
    puzzlesCountedForAverage: 0,
    hasShared: false
  };
  saveStatistics(defaultStats);
  return defaultStats;
}

// Reset only average solve time
function resetAverageSolveTime() {
  const stats = getStatistics();
  stats.totalSolveTime = 0;
  stats.puzzlesCountedForAverage = 0;
  saveStatistics(stats);
  return stats;
}

function updateStatistics(solveTimeSeconds) {
  const stats = getStatistics();

  stats.puzzlesSolved++;
  stats.totalSolveTime += solveTimeSeconds;

  // Increment average counter (initialize if undefined for backwards compatibility)
  if (typeof stats.puzzlesCountedForAverage === 'undefined') {
    stats.puzzlesCountedForAverage = stats.puzzlesSolved;
  } else {
    stats.puzzlesCountedForAverage++;
  }

  if (stats.shortestSolveTime === null || solveTimeSeconds < stats.shortestSolveTime) {
    stats.shortestSolveTime = solveTimeSeconds;
  }

  // Update daily streak
  updateDailyStreak(stats);

  // Request review at appropriate milestones
  requestReviewIfAppropriate(stats);

  saveStatistics(stats);
  return stats;
}

function requestReviewIfAppropriate(stats) {
  // Initialize lastReviewRequest if not set
  if (typeof stats.lastReviewRequest === 'undefined') {
    stats.lastReviewRequest = 0;
  }

  // Request review at puzzle milestones: 10, 30, 60, 100, and every 100 thereafter
  // But only if we haven't requested in the last 50 puzzles
  const puzzlesSinceLastRequest = stats.puzzlesSolved - stats.lastReviewRequest;
  const reviewMilestones = [10, 30, 60, 100];

  let shouldRequest = false;

  // Check if we hit a milestone
  if (reviewMilestones.includes(stats.puzzlesSolved)) {
    shouldRequest = true;
  }
  // After 100, request every 100 puzzles
  else if (stats.puzzlesSolved > 100 && stats.puzzlesSolved % 100 === 0) {
    shouldRequest = true;
  }

  // Only request if enough puzzles have passed since last request
  if (shouldRequest && puzzlesSinceLastRequest >= 50) {
    stats.lastReviewRequest = stats.puzzlesSolved;
    saveStatistics(stats);

    // Call Android interface to request review
    if (window.Android && window.Android.requestReview) {
      window.Android.requestReview();
    }
  }
}

// Get today's date as YYYY-MM-DD string
function getTodayDateString() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Update daily streak tracking
function updateDailyStreak(stats) {
  const today = getTodayDateString();
  const lastPlayed = stats.lastPlayedDate;

  if (!lastPlayed) {
    // First time playing
    stats.currentStreak = 1;
    stats.highestStreak = 1;
    stats.lastPlayedDate = today;
  } else if (lastPlayed === today) {
    // Already played today, don't update streak
    return;
  } else {
    // Calculate days difference
    const lastDate = new Date(lastPlayed);
    const todayDate = new Date(today);
    const daysDiff = Math.floor((todayDate - lastDate) / (1000 * 60 * 60 * 24));

    if (daysDiff === 1) {
      // Consecutive day - increment streak
      stats.currentStreak++;
    } else {
      // Streak broken - reset to 1
      stats.currentStreak = 1;
    }

    // Update highest streak if current is higher
    if (stats.currentStreak > stats.highestStreak) {
      stats.highestStreak = stats.currentStreak;
    }

    stats.lastPlayedDate = today;
  }
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
      cell.style.color = '#0000FF'; // Blue text for player-placed letters
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
    // If clicking outside of a cell or letter button, remove highlighting
    const isCell = e.target.tagName === 'TD';
    const isLetterButton = e.target.classList.contains('letter-button');

    if (!isCell && !isLetterButton) {
      if (state.selectedCell) {
        state.selectedCell.classList.remove('highlighted');
        state.selectedCell = null;
      }
      if (state.selectedLetter) {
        state.selectedLetter.classList.remove('selected');
        state.selectedLetter = null;
      }
    }
  });

  // Add click handlers for all grid cells
  elements.gridboard.addEventListener('click', (e) => {
    // Prevent click if we just finished a drag
    if (dragState.justFinishedDrag) {
      dragState.justFinishedDrag = false;
      return;
    }

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
          const allCells = elements.gridboard.getElementsByTagName('td');
          Array.from(allCells).forEach(c => c.classList.remove('highlighted'));
          cell.classList.add('highlighted');
          state.selectedCell = cell;

          // Focus the hidden input
          const hiddenInput = document.getElementById('veryhard-keyboard-input');
          if (hiddenInput) {
            hiddenInput.focus();
          }
          return;
        }

        const letter = state.grid[row][col];

        // Find and re-enable ONE disabled button with this letter
        const disabledButton = Object.values(elements.letterButtons).find(button =>
          button.textContent === letter && button.disabled
        );
        if (disabledButton) {
          disabledButton.disabled = false;
        }

        // Reset the cell
        state.grid[row][col] = ' ';
        cell.textContent = ' ';
        cell.classList.remove('player-placed', 'correct');
        cell.classList.add('empty-cell');
        cell.style.removeProperty('color');

        // Update game state
        state.filledPositions--;
        return;
      }

      // Requirement 2: When an empty square is tapped
      if (isValidPosition && cell.classList.contains('empty-cell')) {
        if (state.selectedLetter && !state.selectedLetter.disabled) {
          // If a letter is highlighted, place the letter in that square
          const letterToPlace = state.selectedLetter.textContent;
          const buttonToDisable = state.selectedLetter;

          // Clear any highlighting first
          cell.classList.remove('highlighted', 'empty-cell', 'correct');

          // Update grid state
          state.grid[row][col] = letterToPlace;

          // Place the selected letter into this cell - EXPLICIT visual update
          cell.textContent = letterToPlace;
          cell.classList.add('player-placed');
          cell.style.color = '#0000FF'; // Blue text for player-placed letters

          // Disable the letter button
          buttonToDisable.disabled = true;
          buttonToDisable.classList.remove('selected');
          state.selectedLetter = null;

          // Clear all cell selections
          if (state.selectedCell) {
            state.selectedCell.classList.remove('highlighted');
            state.selectedCell = null;
          }
          const allCells = elements.gridboard.getElementsByTagName('td');
          Array.from(allCells).forEach(c => c.classList.remove('highlighted'));

          // Recalculate filled positions
          state.filledPositions = countFilledPositions();

          if (state.filledPositions === 5) {
            checkWinCondition();
          }
        } else {
          // If a letter is not highlighted, highlight the empty square
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

    }
  });

  // Shared drag state for all buttons and cells
  const dragState = {
    isDragging: false,
    isPotentialDrag: false,
    draggedButton: null,
    draggedCell: null, // Track if dragging from a cell instead of a button
    currentDropTarget: null,
    dragIndicator: null,
    startX: 0,
    startY: 0,
    dragTimer: null,
    justFinishedDrag: false // Flag to prevent click after drag
  };

  const DRAG_THRESHOLD = 10; // pixels to move before considering it a drag
  const HOLD_THRESHOLD = 150; // milliseconds to hold before considering it a drag
  const TOUCH_OFFSET_Y = 80; // pixels to offset above finger on touch devices

  // Helper function to create floating drag indicator
  function createDragIndicator(letter) {
    const indicator = document.createElement('div');
    indicator.className = 'drag-indicator';
    indicator.textContent = letter;
    document.body.appendChild(indicator);
    return indicator;
  }

  // Helper function to position drag indicator
  function positionDragIndicator(indicator, x, y, isTouch) {
    if (!indicator) return;
    // Position indicator directly at cursor/touch position
    indicator.style.left = `${x}px`;
    indicator.style.top = `${y}px`;
  }

  // Letter button click handlers
  Object.values(elements.letterButtons).forEach(button => {
    button.addEventListener('click', (e) => {
      // Prevent click if we just finished a drag
      if (dragState.justFinishedDrag) {
        dragState.justFinishedDrag = false;
        return;
      }

      // Requirement 1: When a letter button is tapped
      if (state.selectedCell && state.selectedCell.classList.contains('empty-cell')) {
        // If an empty square is highlighted, place the letter in that square
        const rowIndex = parseInt(state.selectedCell.dataset.row);
        const cellIndex = parseInt(state.selectedCell.dataset.col);

        // Clear any existing classes first
        state.selectedCell.classList.remove('correct', 'empty-cell', 'highlighted');

        // Update grid state
        state.grid[rowIndex][cellIndex] = button.textContent;

        // Update the cell with new letter - EXPLICIT visual update
        state.selectedCell.textContent = button.textContent;
        state.selectedCell.classList.add('player-placed');
        state.selectedCell.style.color = '#0000FF'; // Blue text for player-placed letters

        // Clear cell selection
        state.selectedCell = null;

        // Remove letter selection if any
        if (state.selectedLetter) {
          state.selectedLetter.classList.remove('selected');
          state.selectedLetter = null;
        }

        // Also remove selected class from the button being clicked
        button.classList.remove('selected');

        // Disable this specific button
        button.disabled = true;

        // Recalculate filled positions
        state.filledPositions = countFilledPositions();

        if (state.filledPositions === 5) {
          checkWinCondition();
        }
      } else {
        // If an empty square is not highlighted, highlight the letter
        // Remove selection from previously selected letter
        if (state.selectedLetter) {
          state.selectedLetter.classList.remove('selected');
        }

        // Select this letter
        button.classList.add('selected');
        state.selectedLetter = button;
      }
    });

    // Touch start handler
    button.addEventListener('touchstart', (e) => {
      if (button.disabled) return;

      const touch = e.touches[0];
      dragState.isPotentialDrag = true;
      dragState.draggedButton = button;
      dragState.startX = touch.clientX;
      dragState.startY = touch.clientY;

      // Set a timer - if user holds for HOLD_THRESHOLD, start dragging
      dragState.dragTimer = setTimeout(() => {
        if (dragState.isPotentialDrag) {
          dragState.isDragging = true;
          button.classList.add('dragging');
          // Create and position the drag indicator
          dragState.dragIndicator = createDragIndicator(button.textContent);
          positionDragIndicator(dragState.dragIndicator, dragState.startX, dragState.startY, true);
          // Now prevent scrolling since we're dragging
          document.body.style.touchAction = 'none';
        }
      }, HOLD_THRESHOLD);
    });

    // Mouse down handler
    button.addEventListener('mousedown', (e) => {
      if (button.disabled) return;

      dragState.isPotentialDrag = true;
      dragState.draggedButton = button;
      dragState.startX = e.clientX;
      dragState.startY = e.clientY;

      // Set a timer for mouse as well
      dragState.dragTimer = setTimeout(() => {
        if (dragState.isPotentialDrag) {
          dragState.isDragging = true;
          button.classList.add('dragging');
          // Create and position the drag indicator
          dragState.dragIndicator = createDragIndicator(button.textContent);
          positionDragIndicator(dragState.dragIndicator, dragState.startX, dragState.startY, false);
        }
      }, HOLD_THRESHOLD);
    });

    // Touch move handler
    button.addEventListener('touchmove', (e) => {
      if (!dragState.isPotentialDrag) return;

      const touch = e.touches[0];
      const deltaX = Math.abs(touch.clientX - dragState.startX);
      const deltaY = Math.abs(touch.clientY - dragState.startY);

      // If moved beyond threshold, start dragging immediately
      if (!dragState.isDragging && (deltaX > DRAG_THRESHOLD || deltaY > DRAG_THRESHOLD)) {
        clearTimeout(dragState.dragTimer);
        dragState.isDragging = true;
        button.classList.add('dragging');
        // Create drag indicator if movement triggered drag
        dragState.dragIndicator = createDragIndicator(button.textContent);
        positionDragIndicator(dragState.dragIndicator, touch.clientX, touch.clientY, true);
        document.body.style.touchAction = 'none';
      }

      if (dragState.isDragging) {
        e.preventDefault();
        // Update drag indicator position
        positionDragIndicator(dragState.dragIndicator, touch.clientX, touch.clientY, true);
        const elementAtPoint = document.elementFromPoint(touch.clientX, touch.clientY);
        handleDragOver(elementAtPoint, dragState);
      }
    });

    // Touch end handler
    button.addEventListener('touchend', (e) => {
      // Clear the timer if it hasn't fired yet
      clearTimeout(dragState.dragTimer);

      if (dragState.isDragging) {
        e.preventDefault();
        const touch = e.changedTouches[0];
        const elementAtPoint = document.elementFromPoint(touch.clientX, touch.clientY);
        handleDrop(elementAtPoint, dragState);
        document.body.style.touchAction = '';
      }

      resetDragState(dragState);
    });
  });

  // Global mouse move handler (works for both buttons and cells)
  document.addEventListener('mousemove', (e) => {
    if (!dragState.isPotentialDrag) return;

    const deltaX = Math.abs(e.clientX - dragState.startX);
    const deltaY = Math.abs(e.clientY - dragState.startY);

    // If moved beyond threshold, start dragging immediately
    if (!dragState.isDragging && (deltaX > DRAG_THRESHOLD || deltaY > DRAG_THRESHOLD)) {
      clearTimeout(dragState.dragTimer);
      dragState.isDragging = true;

      // Add dragging class to the appropriate element
      if (dragState.draggedButton) {
        dragState.draggedButton.classList.add('dragging');
        dragState.dragIndicator = createDragIndicator(dragState.draggedButton.textContent);
      } else if (dragState.draggedCell) {
        dragState.draggedCell.classList.add('dragging');
        dragState.dragIndicator = createDragIndicator(dragState.draggedCell.textContent);
      }

      positionDragIndicator(dragState.dragIndicator, e.clientX, e.clientY, false);
    }

    if (dragState.isDragging) {
      // Update drag indicator position
      positionDragIndicator(dragState.dragIndicator, e.clientX, e.clientY, false);
      const elementAtPoint = document.elementFromPoint(e.clientX, e.clientY);
      handleDragOver(elementAtPoint, dragState);
    }
  });

  // Global mouse up handler (works for both buttons and cells)
  document.addEventListener('mouseup', (e) => {
    // Clear the timer if it hasn't fired yet
    clearTimeout(dragState.dragTimer);

    if (dragState.isDragging) {
      const elementAtPoint = document.elementFromPoint(e.clientX, e.clientY);
      handleDrop(elementAtPoint, dragState);
    }

    resetDragState(dragState);
  });

  // Add drag handlers for player-placed cells (to allow dragging letters between squares)
  elements.gridboard.addEventListener('touchstart', (e) => {
    const cell = e.target;
    if (cell.tagName === 'TD' && cell.classList.contains('player-placed')) {
      const touch = e.touches[0];
      dragState.isPotentialDrag = true;
      dragState.draggedCell = cell;
      dragState.startX = touch.clientX;
      dragState.startY = touch.clientY;

      // Set a timer - if user holds for HOLD_THRESHOLD, start dragging
      dragState.dragTimer = setTimeout(() => {
        if (dragState.isPotentialDrag) {
          dragState.isDragging = true;
          cell.classList.add('dragging');
          // Create and position the drag indicator
          dragState.dragIndicator = createDragIndicator(cell.textContent);
          positionDragIndicator(dragState.dragIndicator, dragState.startX, dragState.startY, true);
          // Prevent scrolling since we're dragging
          document.body.style.touchAction = 'none';
        }
      }, HOLD_THRESHOLD);
    }
  });

  elements.gridboard.addEventListener('mousedown', (e) => {
    const cell = e.target;
    if (cell.tagName === 'TD' && cell.classList.contains('player-placed')) {
      dragState.isPotentialDrag = true;
      dragState.draggedCell = cell;
      dragState.startX = e.clientX;
      dragState.startY = e.clientY;

      // Set a timer for mouse as well
      dragState.dragTimer = setTimeout(() => {
        if (dragState.isPotentialDrag) {
          dragState.isDragging = true;
          cell.classList.add('dragging');
          // Create and position the drag indicator
          dragState.dragIndicator = createDragIndicator(cell.textContent);
          positionDragIndicator(dragState.dragIndicator, dragState.startX, dragState.startY, false);
        }
      }, HOLD_THRESHOLD);
    }
  });

  // Touch move handler for cells
  elements.gridboard.addEventListener('touchmove', (e) => {
    if (!dragState.isPotentialDrag || !dragState.draggedCell) return;

    const touch = e.touches[0];
    const deltaX = Math.abs(touch.clientX - dragState.startX);
    const deltaY = Math.abs(touch.clientY - dragState.startY);

    // If moved beyond threshold, start dragging immediately
    if (!dragState.isDragging && (deltaX > DRAG_THRESHOLD || deltaY > DRAG_THRESHOLD)) {
      clearTimeout(dragState.dragTimer);
      dragState.isDragging = true;
      dragState.draggedCell.classList.add('dragging');
      // Create drag indicator if movement triggered drag
      dragState.dragIndicator = createDragIndicator(dragState.draggedCell.textContent);
      positionDragIndicator(dragState.dragIndicator, touch.clientX, touch.clientY, true);
      document.body.style.touchAction = 'none';
    }

    if (dragState.isDragging) {
      e.preventDefault();
      // Update drag indicator position
      positionDragIndicator(dragState.dragIndicator, touch.clientX, touch.clientY, true);
      const elementAtPoint = document.elementFromPoint(touch.clientX, touch.clientY);
      handleDragOver(elementAtPoint, dragState);
    }
  });

  // Touch end handler for cells
  elements.gridboard.addEventListener('touchend', (e) => {
    const cell = e.target;
    if (cell.tagName === 'TD' && dragState.draggedCell) {
      // Clear the timer if it hasn't fired yet
      clearTimeout(dragState.dragTimer);

      if (dragState.isDragging) {
        e.preventDefault();
        const touch = e.changedTouches[0];
        const elementAtPoint = document.elementFromPoint(touch.clientX, touch.clientY);
        handleDrop(elementAtPoint, dragState);
        document.body.style.touchAction = '';
      }

      resetDragState(dragState);
    }
  });

  // Helper function to handle drag over cells
  function handleDragOver(element, dragState) {
    // Clear previous drop target highlighting
    if (dragState.currentDropTarget) {
      dragState.currentDropTarget.classList.remove('drop-target-valid');
    }

    if (element && element.tagName === 'TD') {
      const row = parseInt(element.dataset.row);
      const col = parseInt(element.dataset.col);

      // Check if this is a valid position (one of the 5 blank positions)
      const isValidPosition = state.locsToBlankX.some((x, i) =>
        x === row && state.locsToBlankY[i] === col
      );

      // Don't highlight the source cell when dragging from a cell
      const isSourceCell = dragState.draggedCell && dragState.draggedCell === element;

      // Highlight valid positions (both empty and player-placed cells), except source cell
      if (isValidPosition && !isSourceCell) {
        element.classList.add('drop-target-valid');
        dragState.currentDropTarget = element;
      }
    }
  }

  // Helper function to handle drop
  // Requirement 3: When a letter is dragged (from button or from cell)
  function handleDrop(element, dragState) {
    if (element && element.tagName === 'TD') {
      const row = parseInt(element.dataset.row);
      const col = parseInt(element.dataset.col);

      // Check if this is a valid position (one of the 5 blank positions)
      const isValidPosition = state.locsToBlankX.some((x, i) =>
        x === row && state.locsToBlankY[i] === col
      );

      if (isValidPosition) {
        // Determine the letter being dragged and its source
        let letterToPlace;
        let sourceIsCell = false;

        if (dragState.draggedCell) {
          // Dragging from a cell
          letterToPlace = dragState.draggedCell.textContent;
          sourceIsCell = true;
        } else if (dragState.draggedButton) {
          // Dragging from a button
          letterToPlace = dragState.draggedButton.textContent;
        } else {
          return; // No valid drag source
        }

        // Don't allow dropping on the same cell we're dragging from
        if (sourceIsCell && dragState.draggedCell === element) {
          return;
        }

        // If released in a square with an already-placed letter
        if (element.classList.contains('player-placed') && state.grid[row][col] !== ' ') {
          const oldLetter = state.grid[row][col];

          // Find and re-enable the first disabled button with this letter
          const disabledButton = Object.values(elements.letterButtons).find(button =>
            button.textContent === oldLetter && button.disabled
          );
          if (disabledButton) {
            disabledButton.disabled = false;
          }
        }

        // Place the new letter in the square
        element.textContent = letterToPlace;
        element.classList.remove('correct', 'empty-cell');
        element.classList.add('player-placed');
        element.style.color = '#0000FF'; // Blue text for player-placed letters
        state.grid[row][col] = letterToPlace;

        // Handle the source: clear cell or disable button
        if (sourceIsCell) {
          // Clear the source cell
          const sourceRow = parseInt(dragState.draggedCell.dataset.row);
          const sourceCol = parseInt(dragState.draggedCell.dataset.col);
          dragState.draggedCell.textContent = ' ';
          dragState.draggedCell.classList.remove('player-placed', 'correct');
          dragState.draggedCell.classList.add('empty-cell');
          dragState.draggedCell.style.removeProperty('color');
          state.grid[sourceRow][sourceCol] = ' ';
        } else {
          // Disable the dragged letter button
          dragState.draggedButton.disabled = true;
        }

        // Clear any selections
        if (state.selectedCell) {
          state.selectedCell.classList.remove('highlighted');
          state.selectedCell = null;
        }
        if (state.selectedLetter) {
          state.selectedLetter.classList.remove('selected');
          state.selectedLetter = null;
        }

        // Recalculate filled positions
        state.filledPositions = countFilledPositions();

        if (state.filledPositions === 5) {
          checkWinCondition();
        }
      }
    }
  }

  // Helper function to reset drag state
  function resetDragState(dragState) {
    if (dragState.draggedButton) {
      dragState.draggedButton.classList.remove('dragging');
    }
    if (dragState.draggedCell) {
      dragState.draggedCell.classList.remove('dragging');
    }
    if (dragState.currentDropTarget) {
      dragState.currentDropTarget.classList.remove('drop-target-valid');
    }
    if (dragState.dragIndicator) {
      dragState.dragIndicator.remove();
    }
    clearTimeout(dragState.dragTimer);

    // Set flag if we just finished a drag (to prevent click event from firing)
    if (dragState.isDragging) {
      dragState.justFinishedDrag = true;
      // Clear the flag after a short delay
      setTimeout(() => {
        dragState.justFinishedDrag = false;
      }, 100);
    }

    dragState.isDragging = false;
    dragState.isPotentialDrag = false;
    dragState.draggedButton = null;
    dragState.draggedCell = null;
    dragState.currentDropTarget = null;
    dragState.dragIndicator = null;
    dragState.dragTimer = null;
  }
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
      background-color: #f0f0f0;  /* Light gray background on hover */
      border-color: #999999;      /* Gray border on hover */
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
      z-index: 30;
      cursor: pointer;
    `;

    // Add main message
    messageDiv.textContent = getRandomAffirmation();

    document.body.appendChild(messageDiv);

    // Remove message when user taps anywhere
    const dismissMessage = () => {
      messageDiv.remove();
      document.removeEventListener('click', dismissMessage);
    };

    // Use setTimeout to add listener after a brief delay to prevent immediate dismissal
    setTimeout(() => {
      document.addEventListener('click', dismissMessage);
    }, 100);
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

    // Clear any selected letter button highlighting before victory animations
    if (state.selectedLetter) {
      state.selectedLetter.classList.remove('selected');
      state.selectedLetter = null;
    }

    // Clear any highlighted cell before victory animations
    if (state.selectedCell) {
      state.selectedCell.classList.remove('highlighted');
      state.selectedCell = null;
    }

    // Get puzzles solved before updating
    const statsBefore = getStatistics();
    const puzzlesBefore = statsBefore.puzzlesSolved;

    // Update statistics
    updateStatistics(solveTimeSeconds);

    // Check for newly unlocked color palettes
    const statsAfter = getStatistics();
    const puzzlesAfter = statsAfter.puzzlesSolved;
    checkForNewUnlocks(puzzlesBefore, puzzlesAfter);

    // Highlight the first five words with color scheme
    // Note: highlightCorrectLetters() is not needed as highlightAllWords() handles all coloring
    highlightAllWords();
    // Show win message
    showWinMessage();
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
        In this mode, you are not given letters. Instead, tap on an empty square and input any letter. The five letters you enter must form a valid five-letter word, and the grid must contain 5 valid five-letter words. Good luck!
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

// Create hidden input for mobile keyboard in Very Hard mode
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
  cell.style.color = '#0000FF'; // Blue text for player-placed letters

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
  return word.toLowerCase();
}

// Get cell positions for a word based on type and index
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

// Check if a word is valid (exists in full word list)
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
    if (state.selectedLetter) {
      state.selectedLetter.classList.remove('selected');
      state.selectedLetter = null;
    }
    if (state.selectedCell) {
      state.selectedCell.classList.remove('highlighted');
      state.selectedCell = null;
    }

    // Get puzzles solved before updating
    const statsBefore = getStatistics();
    const puzzlesBefore = statsBefore.puzzlesSolved;

    // Update statistics
    updateStatistics(solveTimeSeconds);

    // Check for newly unlocked color palettes
    const statsAfter = getStatistics();
    const puzzlesAfter = statsAfter.puzzlesSolved;
    checkForNewUnlocks(puzzlesBefore, puzzlesAfter);

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
  const selectedScheme = getSelectedColorScheme();
  const scheme = colorSchemes[selectedScheme] || colorSchemes['START'];
  const colors = scheme.colors;

  // Add special effect styles if needed (for animated schemes)
  if (selectedScheme === 'NEONS' || selectedScheme === 'QUEEN' || selectedScheme === 'LIGHTS') {
    addSpecialEffectStyles();
  }

  wordsToHighlight.forEach((wordInfo, index) => {
    const positions = getWordPositions(wordInfo.type, wordInfo.index);
    const color = colors[index % colors.length];

    positions.forEach((pos, letterIndex) => {
      const cell = elements.gridboard.querySelector(`td[data-row="${pos.row}"][data-col="${pos.col}"]`);
      if (cell) {
        cell.style.backgroundColor = color;

        // Calculate brightness and set text color
        const r = parseInt(color.slice(1, 3), 16);
        const g = parseInt(color.slice(3, 5), 16);
        const b = parseInt(color.slice(5, 7), 16);
        const brightness = (r * 299 + g * 587 + b * 114) / 1000;
        cell.style.color = brightness > 128 ? '#000000' : '#FFFFFF';

        // Add gray border and green text to player-placed letters
        const isPlayerPlaced = cell.classList.contains('player-placed');
        if (isPlayerPlaced) {
          cell.style.border = '3px solid #888888';
          cell.style.color = brightness > 128 ? '#006400' : '#90EE90';
        }

        // Add special effects for certain schemes
        if (selectedScheme === 'NEONS') {
          cell.classList.add('neon-glow');
          cell.style.boxShadow = `0 0 10px ${color}, 0 0 20px ${color}, 0 0 30px ${color}`;
        } else if (selectedScheme === 'QUEEN') {
          cell.classList.add('queen-sparkle');
        } else if (selectedScheme === 'LIGHTS') {
          cell.classList.add('vegas-light');
          cell.style.textShadow = `0 0 10px ${color}, 0 0 20px ${color}`;
          cell.style.boxShadow = `0 0 10px ${color}, 0 0 20px ${color}`;
          cell.style.animationDelay = `${letterIndex * 0.2}s`;
          cell.setAttribute('data-word-index', index);
          cell.setAttribute('data-letter-index', letterIndex);
        }
      }
    });
  });

  // Start Vegas lights animation if LIGHTS scheme is selected
  if (selectedScheme === 'LIGHTS') {
    startVegasLightsAnimation();
  }
}

// Check if any new color palettes were unlocked
function checkForNewUnlocks(puzzlesBefore, puzzlesAfter) {
  const schemeOrder = ['BIRDS', 'RIVER', 'PINKS', 'CARDS', 'TRASH', 'WOODS', 'STARS', 'PARTY', 'BLAST', 'POWER', 'NEONS', 'QUEEN', 'LIGHTS'];

  for (const schemeName of schemeOrder) {
    const scheme = colorSchemes[schemeName];
    // Check if this scheme was just unlocked (wasn't unlocked before, but is now)
    if (puzzlesBefore < scheme.requiredPuzzles && puzzlesAfter >= scheme.requiredPuzzles) {
      showUnlockNotification(schemeName);
      break; // Only show one unlock notification at a time
    }
  }
}

// Show notification for newly unlocked color palette
function showUnlockNotification(paletteName) {
  // Wait a moment for the win message to appear first
  setTimeout(() => {
    const notification = document.createElement('div');
    notification.id = 'unlock-notification';
    notification.style.cssText = `
      position: fixed;
      top: 38%;
      left: 50%;
      transform: translate(-50%, -50%);
      background-color: rgba(255, 255, 255, 0.95);
      padding: 15px 25px;
      border-radius: 10px;
      box-shadow: 0 0 15px rgba(99, 102, 241, 0.5);
      font-size: 16px;
      color: #6366F1;
      text-align: center;
      z-index: 30;
      border: 2px solid #6366F1;
    `;
    notification.innerHTML = `
      <div style="font-weight: bold; margin-bottom: 5px;">New color palette unlocked!</div>
      <div style="font-size: 20px; font-weight: bold;">${paletteName}</div>
    `;
    document.body.appendChild(notification);

    // Remove notification after 4 seconds (slightly after win message)
    setTimeout(() => {
      notification.remove();
    }, 4000);
  }, 300);
}

// Add new function to highlight all words
function highlightAllWords() {
  // Get the selected color scheme
  const selectedSchemeName = getSelectedColorScheme();
  const selectedScheme = colorSchemes[selectedSchemeName] || colorSchemes.START;
  const colors = selectedScheme.colors;

  // Add special effect styles if needed
  if (selectedSchemeName === 'NEONS' || selectedSchemeName === 'QUEEN' || selectedSchemeName === 'LIGHTS') {
    addSpecialEffectStyles();
  }

  // Highlight each word
  state.wordPositions.forEach((wordData, index) => {
    if (index < 5) { // Only highlight first 5 words
      const color = colors[index];
      wordData.positions.forEach((pos, letterIndex) => {
        const cell = elements.gridboard.rows[pos.row].cells[pos.col];
        // Only highlight if the cell isn't a blank space
        if (state.grid[pos.row][pos.col] !== ' ') {
          cell.style.backgroundColor = color;
          // Use dark text for light colors, white text for dark colors
          const brightness = getBrightness(color);
          cell.style.color = brightness > 128 ? '#000000' : '#FFFFFF';
          cell.style.transition = 'background-color 0.3s ease';

          // Add gray border and green text to player-placed letters
          const isPlayerPlaced = cell.classList.contains('player-placed');
          if (isPlayerPlaced) {
            cell.style.border = '3px solid #888888';
            cell.style.color = brightness > 128 ? '#006400' : '#90EE90';
          }

          // Apply special effects for NEONS and QUEEN
          if (selectedSchemeName === 'NEONS') {
            cell.classList.add('neon-glow');
            cell.style.boxShadow = `0 0 10px ${color}, 0 0 20px ${color}, 0 0 30px ${color}`;
          } else if (selectedSchemeName === 'QUEEN') {
            cell.classList.add('queen-sparkle');
          } else if (selectedSchemeName === 'LIGHTS') {
            // Apply Vegas lights animation
            cell.classList.add('vegas-light');
            cell.style.textShadow = `0 0 10px ${color}, 0 0 20px ${color}`;
            cell.style.boxShadow = `0 0 10px ${color}, 0 0 20px ${color}`;
            // Set animation delay based on letter position
            cell.style.animationDelay = `${letterIndex * 0.2}s`;
            cell.setAttribute('data-word-index', index);
            cell.setAttribute('data-letter-index', letterIndex);
          }
        }
      });
    }
  });

  // Start Vegas lights animation if LIGHTS scheme is selected
  if (selectedSchemeName === 'LIGHTS') {
    startVegasLightsAnimation();
  }
}

// Add special effect CSS styles
function addSpecialEffectStyles() {
  // Check if styles already exist
  if (document.getElementById('special-effects-styles')) return;

  const style = document.createElement('style');
  style.id = 'special-effects-styles';
  style.textContent = `
    /* Neon glow pulsing effect */
    .neon-glow {
      animation: neonPulse 1.5s ease-in-out infinite alternate;
    }

    @keyframes neonPulse {
      from {
        filter: brightness(1);
      }
      to {
        filter: brightness(1.3);
      }
    }

    /* Queen sparkle effect - gemstone cut */
    .queen-sparkle {
      position: relative;
      overflow: visible;
      animation: queenShimmer 1.5s ease-in-out infinite;
      background-image:
        linear-gradient(135deg, rgba(255,255,255,0.4) 0%, transparent 50%, rgba(255,255,255,0.2) 100%),
        linear-gradient(45deg, transparent 30%, rgba(255,255,255,0.3) 50%, transparent 70%),
        linear-gradient(to bottom, rgba(255,255,255,0.5) 0%, transparent 30%, transparent 70%, rgba(0,0,0,0.2) 100%) !important;
      box-shadow:
        inset 2px 2px 4px rgba(255,255,255,0.8),
        inset -2px -2px 4px rgba(0,0,0,0.3),
        0 0 15px rgba(255,255,255,0.5) !important;
    }

    .queen-sparkle::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background:
        linear-gradient(135deg, transparent 40%, rgba(255,255,255,0.8) 45%, rgba(255,255,255,0.8) 55%, transparent 60%),
        linear-gradient(45deg, transparent 40%, rgba(255,255,255,0.6) 45%, rgba(255,255,255,0.6) 55%, transparent 60%);
      animation: gemSparkle 2s ease-in-out infinite;
      pointer-events: none;
    }

    .queen-sparkle::after {
      content: '✦';
      position: absolute;
      top: -8px;
      right: -8px;
      font-size: 14px;
      color: #FFD700;
      animation: sparkleRotate 1.2s linear infinite;
      text-shadow: 0 0 8px #FFD700, 0 0 15px #FFD700;
    }

    @keyframes queenShimmer {
      0%, 100% {
        filter: brightness(1) saturate(1.2);
      }
      25% {
        filter: brightness(1.4) saturate(1.4);
      }
      50% {
        filter: brightness(1.2) saturate(1.3);
      }
      75% {
        filter: brightness(1.5) saturate(1.5);
      }
    }

    @keyframes gemSparkle {
      0%, 100% {
        opacity: 0;
        transform: translateX(-100%) translateY(-100%);
      }
      50% {
        opacity: 1;
        transform: translateX(100%) translateY(100%);
      }
    }

    @keyframes sparkleRotate {
      from {
        transform: rotate(0deg) scale(1);
        opacity: 0.8;
      }
      25% {
        transform: rotate(90deg) scale(1.5);
        opacity: 1;
      }
      50% {
        transform: rotate(180deg) scale(1);
        opacity: 0.8;
      }
      75% {
        transform: rotate(270deg) scale(1.5);
        opacity: 1;
      }
      to {
        transform: rotate(360deg) scale(1);
        opacity: 0.8;
      }
    }

    /* Vegas lights effect - sequential letter lighting */
    .vegas-light {
      animation: vegasLightPulse 2s ease-in-out infinite;
      transition: all 0.3s ease;
    }

    .vegas-light.lit-up {
      filter: brightness(1.8) saturate(1.5);
      transform: scale(1.1);
    }

    @keyframes vegasLightPulse {
      0%, 100% {
        filter: brightness(1);
      }
      50% {
        filter: brightness(1.2);
      }
    }
  `;
  document.head.appendChild(style);
}

// Clean up special effects from cells
function cleanupSpecialEffects() {
  const cells = document.querySelectorAll('.neon-glow, .queen-sparkle, .vegas-light');
  cells.forEach(cell => {
    cell.classList.remove('neon-glow', 'queen-sparkle', 'vegas-light', 'lit-up');
    cell.style.boxShadow = '';
  });

  // Stop Vegas lights animation if running
  if (window.vegasLightsIntervals) {
    window.vegasLightsIntervals.forEach(intervalId => clearInterval(intervalId));
    window.vegasLightsIntervals = [];
  }
}

// Start Vegas lights animation - sequential letter lighting
function startVegasLightsAnimation() {
  // Stop any existing animation
  if (window.vegasLightsInterval) {
    clearInterval(window.vegasLightsInterval);
  }

  const vegasLights = document.querySelectorAll('.vegas-light');
  if (vegasLights.length === 0) return;

  // Group cells by word
  const wordGroups = {};
  vegasLights.forEach(cell => {
    const wordIndex = cell.getAttribute('data-word-index');
    const letterIndex = parseInt(cell.getAttribute('data-letter-index'));
    if (!wordGroups[wordIndex]) {
      wordGroups[wordIndex] = [];
    }
    wordGroups[wordIndex].push({ cell, letterIndex });
  });

  // Sort letters in each word by position
  Object.keys(wordGroups).forEach(wordIndex => {
    wordGroups[wordIndex].sort((a, b) => a.letterIndex - b.letterIndex);
  });

  // Animate each word independently
  Object.keys(wordGroups).forEach(wordIndex => {
    const letters = wordGroups[wordIndex];
    let currentIndex = 0;

    const animateWord = () => {
      // Remove lit-up class from all letters in this word
      letters.forEach(({ cell }) => cell.classList.remove('lit-up'));

      // Add lit-up class to current letter
      if (letters[currentIndex]) {
        letters[currentIndex].cell.classList.add('lit-up');
      }

      // Move to next letter
      currentIndex = (currentIndex + 1) % letters.length;
    };

    // Start animation for this word with a slight offset based on word index
    setTimeout(() => {
      animateWord(); // Run once immediately
      const intervalId = setInterval(animateWord, 400); // Light up each letter for 400ms

      // Store interval ID for cleanup
      if (!window.vegasLightsIntervals) {
        window.vegasLightsIntervals = [];
      }
      window.vegasLightsIntervals.push(intervalId);
    }, wordIndex * 100); // Offset each word by 100ms
  });
}

// Helper function to calculate color brightness for text contrast
function getBrightness(hexColor) {
  const hex = hexColor.replace('#', '');
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);
  return (r * 299 + g * 587 + b * 114) / 1000;
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

  // Update state and disable all buttons since answer is shown
  state.filledPositions = 5;
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

    // Re-enable one button with this letter
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

      // Re-enable one button with this letter
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

  // Update game state
  state.filledPositions = countFilledPositions();

  // Check win condition if all positions are filled
  if (state.filledPositions === 5) {
    if (isVeryHardMode()) {
      checkVeryHardWinCondition();
    } else {
      checkWinCondition();
    }
  }
}

// Reset letter buttons and clear player placed letters
function resetLetterButtons() {
  // Existing reset code stays the same
  if (state.selectedCell) {
    state.selectedCell.classList.remove('highlighted');
    state.selectedCell = null;
  }

  // Clean up special effects (NEONS and QUEEN)
  cleanupSpecialEffects();

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

  // Re-enable all letter buttons and clear selections
  Object.values(elements.letterButtons).forEach(button => {
    button.disabled = false;
    button.classList.remove('selected');
  });

  // Clear selected letter state
  state.selectedLetter = null;

  const winMessage = document.getElementById('win-message');
  if (winMessage) {
    winMessage.remove();
  }
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

// Helper function to reset grid state for retry
function resetGridForRetry() {
  const currentWordList = getCurrentWordList();
  state.grid = Array(5).fill().map(() => Array(5).fill('_'));
  state.finalWordList = [];
  state.stsqRowList = [];
  state.stsqColList = [];
  state.finalWordCount = 0;
  state.wordPositions = [];
  state.wordList = [...currentWordList];
}

// Returns true if 5 words were successfully placed, false otherwise
function placeInitialWords() {
  const MAX_TOTAL_ATTEMPTS = 50;
  const MAX_CONSECUTIVE_FAILURES = 20;
  let totalAttempts = 0;
  let consecutiveFailures = 0;

  // Place first word
  placeFirstWord();

  // Place words 2-5 with retry logic
  while (state.finalWordCount < 5 && totalAttempts < MAX_TOTAL_ATTEMPTS) {
    const placed = placeNextWord();

    if (placed) {
      consecutiveFailures = 0;
    } else {
      consecutiveFailures++;

      // If we've failed too many times consecutively, restart from scratch
      if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
        console.log('Puzzle generation stuck, restarting...');
        resetGridForRetry();
        placeFirstWord();
        consecutiveFailures = 0;
        totalAttempts++;
      }
    }
  }

  if (state.finalWordCount < 5) {
    console.error('Failed to place 5 words after max attempts');
    return false;
  }
  return true;
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
// Returns true if a word was successfully placed, false otherwise
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
      return true;
    } else {
      // Find word matching partial pattern
      const candidates = findMatchingWords(pattern);
      if (candidates.length > 0) {
        const word = candidates[Math.floor(Math.random() * candidates.length)];
        placeWordInPosition(word, stsqRow, stsqCol, direction);
        updateGameState(word, stsqRow, stsqCol);
        return true;
      }
    }
  }
  // No valid placement found
  return false;
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
// Returns true if a valid sixth word was found, false otherwise
function findSixthWord() {
  const MAX_ATTEMPTS = 500;
  let attempts = 0;
  let sixWordFound = false;

  while (!sixWordFound && attempts < MAX_ATTEMPTS) {
    attempts++;
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

  if (!sixWordFound) {
    console.log('Failed to find sixth word after ' + MAX_ATTEMPTS + ' attempts');
  }
  return sixWordFound;
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

// Helper function to reset full game state for puzzle generation
function resetFullGameState() {
  const currentWordList = getCurrentWordList();
  Object.assign(state, {
    grid: Array(5).fill().map(() => Array(5).fill('_')),
    finalWordList: [],
    stsqRowList: [],
    stsqColList: [],
    finalWordCount: 0,
    wordPositions: [],
    selectedCell: null,
    selectedLetter: null,
    locsToBlankX: [],
    locsToBlankY: [],
    lettersRemoved: [],
    correctWord: '',
    filledPositions: 0,
    wordList: [...currentWordList],
    gameStartTime: Date.now()
  });

  // Remove player word display if present (from Very Hard mode)
  const playerWordDisplay = document.getElementById('player-word-display');
  if (playerWordDisplay) {
    playerWordDisplay.remove();
  }
}

// Initialize game
async function initializeGame() {
  const MAX_FULL_RETRIES = 10;
  let fullRetries = 0;
  let puzzleGenerated = false;

  // Create empty grid first
  createEmptyGrid();

  while (!puzzleGenerated && fullRetries < MAX_FULL_RETRIES) {
    // Reset state for this attempt
    resetFullGameState();

    // Place initial words
    const wordsPlaced = placeInitialWords();

    if (!wordsPlaced) {
      console.log('Failed to place initial words, retrying full puzzle generation...');
      fullRetries++;
      continue;
    }

    // Find and place sixth word
    const sixthWordFound = findSixthWord();

    if (!sixthWordFound) {
      console.log('Failed to find sixth word, retrying full puzzle generation...');
      fullRetries++;
      continue;
    }

    puzzleGenerated = true;
  }

  if (!puzzleGenerated) {
    console.error('Failed to generate puzzle after ' + MAX_FULL_RETRIES + ' full retries');
    // Still fill and display something so the game doesn't completely break
  }

  // Fill remaining spaces
  fillRemainingSpaces();

  // Update display
  updateGridDisplay();
  // Don't call setupLetterButtons() here - it should only be called once at initialization
  // to avoid adding duplicate event listeners

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

// Setup event listeners once (not in initializeGame to avoid duplicates)
setupLetterButtons();
addLetterRemovalStyles();

// Create hidden input for Very Hard mode keyboard
createHiddenKeyboardInput();

// Initialize timer display
document.addEventListener('DOMContentLoaded', () => {
  updateTimerDisplay();
});

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
            Wordfive is a bit like Wordle meets sudoku. 
          </p>
          <br>
          <p>
            You have to find how the letters below the grid fit back into the blank spaces such that there are five 5-letter words in the grid.
          </p>

          <div>
            <h3 class="font-bold mb-2">Game Rules:</h3>
            <ul class="list-disc pl-5 space-y-2">
              <li>The grid contains five 5-letter words placed horizontally, vertically, or diagonally.</li>
              <li>Five letters have been removed from these words, creating empty spaces.</li>
              <li>These removed letters form a sixth 5-letter word.</li>
              <li>Your goal is to fit the letters back into the grid by placing the provided letters in the correct empty spaces to recreate the complete grid with five 5-letter words.</li>
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
              Follow @playwordfive</a> on <a href="https://www.tiktok.com/@playwordfive">TikTok</a>, <a href="https://www.instagram.com/playwordfive/">Instagram</a>, and <a href="https://www.youtube.com/@playwordfive">YouTube</a> for puzzles, tips, commentary, and the latest Wordfive news!
            </p>
            <p>
              Questions? Issues? Contact paul@playwordfive.com.
            </p>
          <div>
        </div>
        <div id="replay-tutorial-container"></div>
        <button class="return-to-game-button" onclick="document.getElementById('help-modal').classList.add('hidden');">Return to Game</button>
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
        <button class="return-to-game-button" onclick="document.getElementById('stats-modal').classList.add('hidden');">Return to Game</button>
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

  // Calculate average solve time using separate counter
  // Use puzzlesCountedForAverage if available, otherwise fall back to puzzlesSolved for backwards compatibility
  const puzzleCount = (typeof stats.puzzlesCountedForAverage !== 'undefined' && stats.puzzlesCountedForAverage > 0)
    ? stats.puzzlesCountedForAverage
    : stats.puzzlesSolved;
  const avgSolveTime = puzzleCount > 0
    ? stats.totalSolveTime / puzzleCount
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
    <div class="stat-item">
      <div class="stat-label">Current Day Streak</div>
      <div class="stat-value">${stats.currentStreak || 0} ${stats.currentStreak === 1 ? 'day' : 'days'}</div>
    </div>
    <div class="stat-item">
      <div class="stat-label">Highest Day Streak</div>
      <div class="stat-value">${stats.highestStreak || 0} ${stats.highestStreak === 1 ? 'day' : 'days'}</div>
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
      <button id="reset-average-button" style="width: 100%; padding: 10px; background-color: #f59e0b; color: white; border: none; border-radius: 4px; font-size: 14px; cursor: pointer; font-weight: 500; margin-bottom: 10px;">
        Reset Average Solve Time
      </button>
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
      // Close the modal and start a new puzzle with the new difficulty
      const statsModal = document.getElementById('stats-modal');
      if (statsModal) {
        statsModal.classList.add('hidden');
      }
      // Reset and initialize a new puzzle at the new difficulty
      state.selectedCell = null;
      initializeGame();
      resetLetterButtons();

      // Show Very Hard mode explainer if selected
      if (newDifficulty === 'veryhard') {
        showVeryHardExplainer();
      }
    });
  }

  // Add event listener for reset average button
  const resetAverageButton = document.getElementById('reset-average-button');
  if (resetAverageButton) {
    resetAverageButton.addEventListener('click', (e) => {
      e.stopPropagation();
      showResetAverageConfirmation();
    });
  }

  // Add event listener for reset stats button
  const resetStatsButton = document.getElementById('reset-stats-button');
  if (resetStatsButton) {
    resetStatsButton.addEventListener('click', (e) => {
      e.stopPropagation();
      showResetConfirmation();
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

// Show custom confirmation dialog for reset statistics
function showResetConfirmation() {
  // Remove existing confirmation if present
  const existingConfirm = document.getElementById('reset-confirm-modal');
  if (existingConfirm) {
    existingConfirm.remove();
  }

  const confirmModal = document.createElement('div');
  confirmModal.id = 'reset-confirm-modal';
  confirmModal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: rgba(0, 0, 0, 0.7);
    z-index: 200;
    display: flex;
    align-items: center;
    justify-content: center;
  `;

  confirmModal.innerHTML = `
    <div style="
      background: white;
      padding: 24px;
      border-radius: 10px;
      max-width: 320px;
      width: 90%;
      text-align: center;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
    ">
      <h3 style="margin: 0 0 12px 0; font-size: 18px; font-weight: bold;">Reset Statistics?</h3>
      <p style="margin: 0 0 20px 0; color: #666; font-size: 14px; line-height: 1.4;">
        Are you sure you want to reset all statistics? This action cannot be undone.
      </p>
      <div style="display: flex; gap: 10px;">
        <button id="reset-cancel-btn" style="
          flex: 1;
          padding: 10px;
          background-color: #e5e7eb;
          color: #333;
          border: none;
          border-radius: 4px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
        ">Cancel</button>
        <button id="reset-confirm-btn" style="
          flex: 1;
          padding: 10px;
          background-color: #ef4444;
          color: white;
          border: none;
          border-radius: 4px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
        ">Reset</button>
      </div>
    </div>
  `;

  document.body.appendChild(confirmModal);

  // Add event listeners
  const cancelBtn = document.getElementById('reset-cancel-btn');
  const confirmBtn = document.getElementById('reset-confirm-btn');

  cancelBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    confirmModal.remove();
  });

  confirmBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    resetStatistics();
    // Also reset color scheme to START
    saveSelectedColorScheme('START');
    updateStatsDisplay();
    confirmModal.remove();
  });

  // Close on background click
  confirmModal.addEventListener('click', (e) => {
    if (e.target === confirmModal) {
      confirmModal.remove();
    }
  });
}

// Show custom confirmation dialog for reset average solve time
function showResetAverageConfirmation() {
  // Remove existing confirmation if present
  const existingConfirm = document.getElementById('reset-average-confirm-modal');
  if (existingConfirm) {
    existingConfirm.remove();
  }

  const confirmModal = document.createElement('div');
  confirmModal.id = 'reset-average-confirm-modal';
  confirmModal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: rgba(0, 0, 0, 0.7);
    z-index: 200;
    display: flex;
    align-items: center;
    justify-content: center;
  `;

  confirmModal.innerHTML = `
    <div style="
      background: white;
      padding: 24px;
      border-radius: 10px;
      max-width: 320px;
      width: 90%;
      text-align: center;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
    ">
      <h3 style="margin: 0 0 12px 0; font-size: 18px; font-weight: bold;">Reset Average Solve Time?</h3>
      <p style="margin: 0 0 20px 0; color: #666; font-size: 14px; line-height: 1.4;">
        This will reset your average solve time calculation. Other statistics will remain unchanged.
      </p>
      <div style="display: flex; gap: 10px;">
        <button id="reset-average-cancel-btn" style="
          flex: 1;
          padding: 10px;
          background-color: #e5e7eb;
          color: #333;
          border: none;
          border-radius: 4px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
        ">Cancel</button>
        <button id="reset-average-confirm-btn" style="
          flex: 1;
          padding: 10px;
          background-color: #f59e0b;
          color: white;
          border: none;
          border-radius: 4px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
        ">Reset</button>
      </div>
    </div>
  `;

  document.body.appendChild(confirmModal);

  // Add event listeners
  const cancelBtn = document.getElementById('reset-average-cancel-btn');
  const confirmBtn = document.getElementById('reset-average-confirm-btn');

  cancelBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    confirmModal.remove();
  });

  confirmBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    resetAverageSolveTime();
    updateStatsDisplay();
    confirmModal.remove();
  });

  // Close on background click
  confirmModal.addEventListener('click', (e) => {
    if (e.target === confirmModal) {
      confirmModal.remove();
    }
  });
}

// Initialize statistics system
document.addEventListener('DOMContentLoaded', createStatsModal);

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

    // Book button
    const bookButton = document.createElement('button');
    bookButton.className = 'book-button';
    bookButton.textContent = 'Go on an adventure!';
    bookButton.addEventListener('click', () => {
        window.open('https://a.co/d/7X7Gbvs', '_blank');
    });

    // Add buttons to container
    buttonContainer.appendChild(shareButton);
    buttonContainer.appendChild(bookButton);

    // Add container after control buttons
    controlButtons.parentNode.insertBefore(buttonContainer, controlButtons.nextSibling);

    // Add click handler for share button
    shareButton.addEventListener('click', shareGame);

    // Update book button visibility based on premium status
    updateBookButton();
}

// Share functionality
function shareGame() {
    const shareText = "Word search meets Sudoku. Try Wordfive!\n\nhttps://playwordfive.com";

    // Mark that user has shared (unlocks CARDS color scheme)
    const stats = getStatistics();
    if (!stats.hasShared) {
        stats.hasShared = true;
        saveStatistics(stats);

        // Show unlock notification if CARDS wasn't already unlocked
        setTimeout(() => {
            showUnlockNotification('CARDS');
        }, 1000);
    }

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

// Tutorial System
const tutorialState = {
  currentStep: 0,
  isActive: false
};

// Check if this is the first time user opens the app
function isTutorialCompleted() {
  return localStorage.getItem('wordfive-tutorial-completed') === 'true';
}

// Mark tutorial as completed
function markTutorialCompleted() {
  localStorage.setItem('wordfive-tutorial-completed', 'true');
}

// Create tutorial overlay element
function createTutorialOverlay() {
  // Remove existing overlay if present
  const existingOverlay = document.getElementById('tutorial-overlay');
  if (existingOverlay) {
    existingOverlay.remove();
  }

  const overlay = document.createElement('div');
  overlay.id = 'tutorial-overlay';
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: rgba(0, 0, 0, 0.7);
    z-index: 2000;
    pointer-events: auto;
  `;
  document.body.appendChild(overlay);
  return overlay;
}

// Create tutorial popup element
function createTutorialPopup(message, position = 'center') {
  const popup = document.createElement('div');
  popup.id = 'tutorial-popup';
  popup.style.cssText = `
    position: fixed;
    background-color: white;
    padding: 20px 25px;
    border-radius: 10px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
    z-index: 2002;
    max-width: 350px;
    width: 90%;
    text-align: center;
    font-size: 16px;
    line-height: 1.5;
    color: #333;
  `;

  popup.innerHTML = `
    <div style="margin-bottom: 15px;">${message}</div>
    <div style="font-size: 12px; color: #888;">Tap anywhere to continue</div>
  `;

  document.body.appendChild(popup);
  return popup;
}

// Position popup relative to an element
function positionPopup(popup, targetElement, placement) {
  const targetRect = targetElement.getBoundingClientRect();
  const popupRect = popup.getBoundingClientRect();

  if (placement === 'below') {
    const top = targetRect.bottom + 15;
    const left = targetRect.left + (targetRect.width / 2) - (popupRect.width / 2);
    popup.style.top = `${top}px`;
    popup.style.left = `${Math.max(10, Math.min(left, window.innerWidth - popupRect.width - 10))}px`;
  } else if (placement === 'above') {
    const top = targetRect.top - popupRect.height - 15;
    const left = targetRect.left + (targetRect.width / 2) - (popupRect.width / 2);
    popup.style.top = `${top}px`;
    popup.style.left = `${Math.max(10, Math.min(left, window.innerWidth - popupRect.width - 10))}px`;
  } else {
    // Center
    popup.style.top = '50%';
    popup.style.left = '50%';
    popup.style.transform = 'translate(-50%, -50%)';
  }
}

// Create highlight box around element
function createHighlight(targetElement) {
  const highlight = document.createElement('div');
  highlight.id = 'tutorial-highlight';

  const rect = targetElement.getBoundingClientRect();
  highlight.style.cssText = `
    position: fixed;
    top: ${rect.top - 5}px;
    left: ${rect.left - 5}px;
    width: ${rect.width + 10}px;
    height: ${rect.height + 10}px;
    border: 3px solid #FFD700;
    border-radius: 8px;
    box-shadow: 0 0 20px rgba(255, 215, 0, 0.5);
    z-index: 2001;
    pointer-events: none;
    background-color: rgba(255, 255, 255, 0.1);
  `;

  document.body.appendChild(highlight);
  return highlight;
}

// Clean up tutorial elements
function cleanupTutorial() {
  const overlay = document.getElementById('tutorial-overlay');
  const popup = document.getElementById('tutorial-popup');
  const highlight = document.getElementById('tutorial-highlight');

  if (overlay) overlay.remove();
  if (popup) popup.remove();
  if (highlight) highlight.remove();

  tutorialState.isActive = false;
  tutorialState.currentStep = 0;
}

// Show tutorial step 1: Welcome message
function showTutorialStep1() {
  tutorialState.currentStep = 1;

  const overlay = createTutorialOverlay();
  const message = "Welcome to Wordfive! Wordfive is a new kind of word game that blends word search and sudoku.";
  const popup = createTutorialPopup(message);

  // Center the popup
  popup.style.top = '50%';
  popup.style.left = '50%';
  popup.style.transform = 'translate(-50%, -50%)';

  // Add click handler to advance to next step
  const clickHandler = (e) => {
    e.stopPropagation();
    overlay.removeEventListener('click', clickHandler);
    popup.removeEventListener('click', clickHandler);
    cleanupTutorial();
    showTutorialStep2();
  };

  overlay.addEventListener('click', clickHandler);
  popup.addEventListener('click', clickHandler);
}

// Show tutorial step 2: Highlight grid
function showTutorialStep2() {
  tutorialState.currentStep = 2;

  const overlay = createTutorialOverlay();
  const gameBoard = document.getElementById('game-board');
  const highlight = createHighlight(gameBoard);

  const message = "This 5x5 grid contains 5 five-letter words. But 5 letters have been removed!";
  const popup = createTutorialPopup(message);

  // Position popup below the grid
  positionPopup(popup, gameBoard, 'below');

  // Add click handler to advance to next step
  const clickHandler = (e) => {
    e.stopPropagation();
    overlay.removeEventListener('click', clickHandler);
    popup.removeEventListener('click', clickHandler);
    cleanupTutorial();
    showTutorialStep3();
  };

  overlay.addEventListener('click', clickHandler);
  popup.addEventListener('click', clickHandler);
}

// Show tutorial step 3: Highlight letter row
function showTutorialStep3() {
  tutorialState.currentStep = 3;

  const overlay = createTutorialOverlay();
  const letterButtons = document.querySelector('.letter-buttons');
  const highlight = createHighlight(letterButtons);

  const message = "The removed letters are found here. Tap an empty square, then tap one of these letters to place it. Place all 5 letters to make 5 five-letter words. Words can go vertical, horizontal, or diagonal.";
  const popup = createTutorialPopup(message);

  // Position popup above the letter row
  positionPopup(popup, letterButtons, 'above');

  // Add click handler to advance to next step
  const clickHandler = (e) => {
    e.stopPropagation();
    overlay.removeEventListener('click', clickHandler);
    popup.removeEventListener('click', clickHandler);
    cleanupTutorial();
    showTutorialStep4();
  };

  overlay.addEventListener('click', clickHandler);
  popup.addEventListener('click', clickHandler);
}

// Show tutorial step 4: Highlight toolbar
function showTutorialStep4() {
  tutorialState.currentStep = 4;

  const overlay = createTutorialOverlay();

  // Get the three buttons to highlight
  const customizeBtn = document.getElementById('customize-button');
  const statsBtn = document.getElementById('stats-button');
  const helpBtn = document.getElementById('help-button');

  // Create a highlight that encompasses all three buttons
  const highlight = createButtonGroupHighlight(customizeBtn, statsBtn, helpBtn);

  const message = "Use these buttons to customize your game, view your stats, read the rules, or replay this tutorial. Good luck, have fun!";
  const popup = createTutorialPopup(message);

  // Position popup below the buttons
  positionPopup(popup, highlight, 'below');

  // Add click handler to end tutorial
  const clickHandler = (e) => {
    e.stopPropagation();
    overlay.removeEventListener('click', clickHandler);
    popup.removeEventListener('click', clickHandler);
    cleanupTutorial();
    markTutorialCompleted();
  };

  overlay.addEventListener('click', clickHandler);
  popup.addEventListener('click', clickHandler);
}

// Create highlight box around a group of buttons
function createButtonGroupHighlight(btn1, btn2, btn3) {
  const highlight = document.createElement('div');
  highlight.id = 'tutorial-highlight';

  // Get bounding rectangles of all three buttons
  const rect1 = btn1.getBoundingClientRect();
  const rect2 = btn2.getBoundingClientRect();
  const rect3 = btn3.getBoundingClientRect();

  // Calculate the bounding box that contains all three buttons
  const left = Math.min(rect1.left, rect2.left, rect3.left);
  const right = Math.max(rect1.right, rect2.right, rect3.right);
  const top = Math.min(rect1.top, rect2.top, rect3.top);
  const bottom = Math.max(rect1.bottom, rect2.bottom, rect3.bottom);

  highlight.style.cssText = `
    position: fixed;
    top: ${top - 8}px;
    left: ${left - 8}px;
    width: ${right - left + 16}px;
    height: ${bottom - top + 16}px;
    border: 3px solid #FFD700;
    border-radius: 20px;
    box-shadow: 0 0 20px rgba(255, 215, 0, 0.5);
    z-index: 2001;
    pointer-events: none;
    background-color: rgba(255, 255, 255, 0.1);
  `;

  document.body.appendChild(highlight);
  return highlight;
}

// Start the tutorial
function startTutorial() {
  if (tutorialState.isActive) return;

  tutorialState.isActive = true;
  showTutorialStep1();
}

// Add replay tutorial button to help modal
function addReplayTutorialButton() {
  const container = document.getElementById('replay-tutorial-container');
  if (!container) return;

  // Check if button already exists
  if (document.getElementById('replay-tutorial-button')) return;

  // Create the replay tutorial button
  const buttonContainer = document.createElement('div');
  buttonContainer.style.cssText = 'margin-top: 20px; padding-top: 20px; border-top: 1px solid #e5e7eb;';

  const replayButton = document.createElement('button');
  replayButton.id = 'replay-tutorial-button';
  replayButton.textContent = 'Replay Tutorial';
  replayButton.style.cssText = `
    width: 100%;
    padding: 10px;
    background-color: #4CAF50;
    color: white;
    border: none;
    border-radius: 4px;
    font-size: 14px;
    cursor: pointer;
    font-weight: 500;
    text-transform: uppercase;
    margin-bottom: 10px;
  `;

  replayButton.addEventListener('click', (e) => {
    e.stopPropagation();
    // Close the help modal
    const helpModal = document.getElementById('help-modal');
    if (helpModal) {
      helpModal.classList.add('hidden');
    }
    // Start the tutorial
    setTimeout(() => startTutorial(), 300);
  });

  buttonContainer.appendChild(replayButton);
  container.appendChild(buttonContainer);
}

// Initialize tutorial system
function initializeTutorial() {
  // Add replay button to help modal after it's created
  setTimeout(addReplayTutorialButton, 100);

  // Check if this is the first time and auto-start tutorial
  if (!isTutorialCompleted()) {
    // Wait a bit for the game to fully load before starting tutorial
    setTimeout(() => {
      startTutorial();
    }, 500);
  }
}

// Call tutorial initialization when DOM is ready
document.addEventListener('DOMContentLoaded', initializeTutorial);

// ============================================================================
// MONETIZATION SYSTEM
// ============================================================================

let isPremiumUser = false;

// Called by Android when page loads to set premium status
window.setPremiumStatus = function(premium) {
  isPremiumUser = premium;
  console.log('Premium status:', isPremiumUser);
  updatePurchaseButton();
  updateBookButton();
};

// Check if user has premium (with fallback for web testing)
function isPremium() {
  if (typeof AndroidPurchase !== 'undefined') {
    return AndroidPurchase.isPremium();
  }
  return isPremiumUser;
}

// Trigger purchase flow
function startPurchase() {
  if (typeof AndroidPurchase !== 'undefined') {
    AndroidPurchase.startPurchaseFlow();
  } else {
    alert('Purchase only available in Android app');
  }
}

// Override isSchemeUnlocked to include premium restrictions
const originalIsSchemeUnlocked = isSchemeUnlocked;
window.isSchemeUnlocked = isSchemeUnlocked = function(schemeName) {
  // Hidden feature: Check if "unlockall!" is in affirmations for testing
  if (isUnlockCheatEnabled()) {
    return true;
  }

  const stats = getStatistics();
  const scheme = colorSchemes[schemeName];

  // Check unlock requirement based on type
  const checkUnlockRequirement = () => {
    if (scheme.requiresShare !== undefined) {
      return stats.hasShared === true;
    }
    if (scheme.requiredStreak !== undefined) {
      return (stats.highestStreak || 0) >= scheme.requiredStreak;
    }
    return stats.puzzlesSolved >= (scheme.requiredPuzzles || 0);
  };

  // Free users can only unlock START, BIRDS, RIVER, PINKS, and CARDS
  if (!isPremium()) {
    if (schemeName === 'START' || schemeName === 'BIRDS' || schemeName === 'RIVER' || schemeName === 'PINKS' || schemeName === 'CARDS') {
      return checkUnlockRequirement();
    }
    return false; // All other schemes locked for free users
  }

  // Premium users can unlock all schemes based on requirements
  return checkUnlockRequirement();
};

// Override showAffirmationsModal to check premium
const originalShowAffirmationsModal = showAffirmationsModal;
window.showAffirmationsModal = showAffirmationsModal = function() {
  if (!isPremium()) {
    showPremiumRequiredModal('Affirmations');
    return;
  }
  originalShowAffirmationsModal();
};

// Show modal explaining premium is required
function showPremiumRequiredModal(featureName) {
  const modal = document.createElement('div');
  modal.id = 'premium-required-modal';
  modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: rgba(0, 0, 0, 0.8);
    z-index: 300;
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
      <h3 style="margin: 0 0 12px 0; font-size: 20px; font-weight: bold; color: #333;">Premium Feature</h3>
      <p style="margin: 0 0 20px 0; color: #666; font-size: 15px; line-height: 1.5;">
        ${featureName} customization is only available in the full version of Wordfive.
      </p>
      <button onclick="startPurchase(); document.getElementById('premium-required-modal').remove();" style="
        width: 100%;
        padding: 12px;
        background-color: #4CAF50;
        color: white;
        border: none;
        border-radius: 6px;
        font-size: 16px;
        font-weight: 600;
        cursor: pointer;
        margin-bottom: 10px;
      ">Unlock Full Game</button>
      <button onclick="document.getElementById('premium-required-modal').remove();" style="
        width: 100%;
        padding: 12px;
        background-color: #e5e7eb;
        color: #333;
        border: none;
        border-radius: 6px;
        font-size: 14px;
        cursor: pointer;
      ">Maybe Later</button>
    </div>
  `;

  document.body.appendChild(modal);
}

// Create purchase modal shown after interstitial ad
window.showPurchaseModalFromAd = function() {
  const modal = document.createElement('div');
  modal.id = 'post-ad-purchase-modal';
  modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: rgba(0, 0, 0, 0.85);
    z-index: 300;
    display: flex;
    align-items: center;
    justify-content: center;
  `;

  modal.innerHTML = `
    <div style="
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      padding: 28px;
      border-radius: 16px;
      max-width: 380px;
      width: 90%;
      text-align: center;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
      color: white;
    ">
      <h2 style="margin: 0 0 8px 0; font-size: 24px; font-weight: bold;">Remove ads forever and unlock additional features!</h2>
      <div style="text-align: left; margin: 20px 0; padding: 16px; background: rgba(255,255,255,0.15); border-radius: 8px; backdrop-filter: blur(10px);">
        <div style="margin-bottom: 12px; display: flex; align-items: start;">
          <span style="margin-right: 8px; font-size: 18px;">✓</span>
          <span style="font-size: 15px; line-height: 1.4;"><strong>Remove all ads forever!</strong></span>
        </div>
        <div style="margin-bottom: 12px; display: flex; align-items: start;">
          <span style="margin-right: 8px; font-size: 18px;">✓</span>
          <span style="font-size: 15px; line-height: 1.4;"><strong>Earn all color options</strong>, including animated options!</span>
        </div>
        <div style="margin-bottom: 12px; display: flex; align-items: start;">
          <span style="margin-right: 8px; font-size: 18px;">✓</span>
          <span style="font-size: 15px; line-height: 1.4;"><strong>Set your own victory messages!</strong></span>
        </div>
        <div style="display: flex; align-items: start;">
          <span style="margin-right: 8px; font-size: 18px;">✓</span>
          <span style="font-size: 15px; line-height: 1.4;"><strong>Support a solo game developer!</strong></span>
        </div>
      </div>
      <button onclick="startPurchase(); document.getElementById('post-ad-purchase-modal').remove();" style="
        width: 100%;
        padding: 14px;
        background-color: #FFD700;
        color: #333;
        border: none;
        border-radius: 8px;
        font-size: 17px;
        font-weight: 700;
        cursor: pointer;
        margin-bottom: 12px;
        box-shadow: 0 4px 12px rgba(255, 215, 0, 0.4);
      ">Unlock Full Game</button>
      <button onclick="document.getElementById('post-ad-purchase-modal').remove();" style="
        width: 100%;
        padding: 12px;
        background-color: rgba(255,255,255,0.2);
        color: white;
        border: 1px solid rgba(255,255,255,0.3);
        border-radius: 8px;
        font-size: 15px;
        cursor: pointer;
      ">Keep Playing</button>
    </div>
  `;

  document.body.appendChild(modal);
};

// Create and add purchase button between Share and Go on Adventure
function createPurchaseButton() {
  const buttonContainer = document.querySelector('.share-button-container');
  if (!buttonContainer) {
    // Create container if it doesn't exist yet
    setTimeout(createPurchaseButton, 100);
    return;
  }

  // Check if button already exists
  if (document.getElementById('premium-purchase-button')) {
    return;
  }

  // Don't create button if user already has premium
  if (isPremium()) {
    return;
  }

  const purchaseButton = document.createElement('button');
  purchaseButton.id = 'premium-purchase-button';
  purchaseButton.className = 'purchase-button';
  purchaseButton.textContent = 'Remove Ads & Unlock Full Game';
  purchaseButton.addEventListener('click', () => {
    startPurchase();
  });

  // Insert between share button and book button
  const bookButton = buttonContainer.querySelector('.book-button');
  buttonContainer.insertBefore(purchaseButton, bookButton);

  // Update visibility based on premium status
  updatePurchaseButton();
}

// Update purchase button visibility
function updatePurchaseButton() {
  const purchaseButton = document.getElementById('premium-purchase-button');
  if (purchaseButton) {
    if (isPremium()) {
      purchaseButton.style.display = 'none';
    } else {
      purchaseButton.style.display = 'block';
    }
  }
}

// Update book button visibility - hide for non-premium users
function updateBookButton() {
  const bookButton = document.querySelector('.book-button');
  if (bookButton) {
    if (isPremium()) {
      bookButton.style.display = 'block';
    } else {
      bookButton.style.display = 'none';
    }
  }
}

// Override New Puzzle button to notify Android
const originalNewPuzzleHandler = elements.newPuzzleButton.onclick;
elements.newPuzzleButton.addEventListener('click', () => {
  if (typeof AndroidPurchase !== 'undefined') {
    AndroidPurchase.onNewPuzzle();
  }
});

// Add purchase button when page loads
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(createPurchaseButton, 500);
});

// Color Scheme Customization System
const colorSchemes = {
  START: {
    name: 'START',
    colors: ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFBE0B'],
    requiredPuzzles: 0
  },
  BIRDS: {
    name: 'BIRDS',
    colors: ['#32CD32', '#FF0000', '#87CEEB', '#FFE135', '#000000'],
    requiredPuzzles: 5
  },
  RIVER: {
    name: 'RIVER',
    colors: ['#1E3A5F', '#3D5A80', '#5B8FB9', '#8ECAE6', '#B8D4E3'],
    requiredPuzzles: 10
  },
  PINKS: {
    name: 'PINKS',
    colors: ['#FF69B4', '#FF1493', '#DB7093', '#FFC0CB', '#FFB6C1'],
    requiredPuzzles: 20
  },
  CARDS: {
    name: 'CARDS',
    colors: ['#DC143C', '#C41E3A', '#8B0000', '#2F4F4F', '#000000'],
    requiresShare: true
  },
  TRASH: {
    name: 'TRASH',
    colors: ['#4A235A', '#556B2F', '#8B4513', '#696969', '#1C1C1C'],
    requiredPuzzles: 30
  },
  WOODS: {
    name: 'WOODS',
    colors: ['#228B22', '#2E8B57', '#8FBC8F', '#6B4423', '#8B7355'],
    requiredPuzzles: 40
  },
  STARS: {
    name: 'STARS',
    colors: ['#0D1B2A', '#1B263B', '#415A77', '#FFD700', '#FFF8DC'],
    requiredPuzzles: 50
  },
  PARTY: {
    name: 'PARTY',
    colors: ['#FF0080', '#00FF80', '#8000FF', '#FF8000', '#00FFFF'],
    requiredPuzzles: 60
  },
  BLAST: {
    name: 'BLAST',
    colors: ['#FF0000', '#FF4500', '#FF8C00', '#FFD700', '#FFA500'],
    requiredPuzzles: 70
  },
  POWER: {
    name: 'POWER',
    colors: ['#DC143C', '#0000CD', '#8B008B', '#228B22', '#FFD700'],
    requiredPuzzles: 80
  },
  NEONS: {
    name: 'NEONS',
    colors: ['#39FF14', '#FF073A', '#FF6EC7', '#04D9FF', '#FFFF00'],
    requiredPuzzles: 90
  },
  QUEEN: {
    name: 'QUEEN',
    colors: ['#FFD700', '#C0C0C0', '#4169E1', '#DC143C', '#50C878'],
    requiredPuzzles: 100
  },
  LIGHTS: {
    name: 'LIGHTS',
    colors: ['#FFD700', '#FFA500', '#FFFF00', '#F0E68C', '#FFFFE0'],
    requiredStreak: 5,
    hasGlow: true,
    hasAnimation: true
  }
};

// Get selected color scheme from localStorage
function getSelectedColorScheme() {
  const saved = localStorage.getItem('wordfive-color-scheme');
  return saved || 'START';
}

// Save selected color scheme to localStorage
function saveSelectedColorScheme(schemeName) {
  localStorage.setItem('wordfive-color-scheme', schemeName);
}

// Check if a color scheme is unlocked
function isSchemeUnlocked(schemeName) {
  // Hidden feature: Check if "unlockall!" is in affirmations for testing
  if (isUnlockCheatEnabled()) {
    return true;
  }

  const stats = getStatistics();
  const scheme = colorSchemes[schemeName];

  // Check for share requirement
  if (scheme.requiresShare !== undefined) {
    return stats.hasShared === true;
  }

  // Check for streak requirement
  if (scheme.requiredStreak !== undefined) {
    return (stats.highestStreak || 0) >= scheme.requiredStreak;
  }

  // Check for puzzle requirement
  return stats.puzzlesSolved >= (scheme.requiredPuzzles || 0);
}

// Hidden feature: Check if unlock cheat is enabled via affirmations
function isUnlockCheatEnabled() {
  const affirmations = getAffirmations();
  return affirmations.some(a => a && a.toLowerCase().includes('unlockall!'));
}

// Create customization modal
function createCustomizationModal() {
  const header = document.querySelector('.game-header');
  if (!header) return;

  // Create customize button
  const customizeButton = document.createElement('button');
  customizeButton.id = 'customize-button';
  customizeButton.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M18.37 2.63 14 7l-1.59-1.59a2 2 0 0 0-2.82 0L8 7l9 9 1.59-1.59a2 2 0 0 0 0-2.82L17 10l4.37-4.37a2.12 2.12 0 1 0-3-3Z"></path>
      <path d="M9 8c-2 3-4 3.5-7 4l8 10c2-1 6-5 6-7"></path>
      <path d="M14.5 17.5 4.5 15"></path>
    </svg>
  `;
  header.appendChild(customizeButton);

  // Create modal
  const modal = document.createElement('div');
  modal.id = 'customize-modal';
  modal.className = 'hidden fixed inset-0 bg-black bg-opacity-50 z-40';
  modal.innerHTML = `
    <div class="fixed inset-0 flex items-center justify-center p-4">
      <div class="bg-white rounded-lg p-6 max-w-md w-full max-h-[90vh] overflow-y-auto relative">
        <h2 class="text-xl font-bold mb-2">Customize Colors</h2>
        <p style="color: #666; font-size: 14px; margin-bottom: 20px; text-align: center;">
          Solve puzzles to unlock new victory color options!
        </p>
        <div id="color-schemes-list" class="space-y-3">
          <!-- Color schemes will be populated here -->
        </div>
        <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
          <button id="adjust-affirmations-button" style="
            width: 100%;
            padding: 10px;
            background-color: #6366F1;
            color: white;
            border: none;
            border-radius: 4px;
            font-size: 14px;
            cursor: pointer;
            font-weight: 500;
            text-transform: uppercase;
          ">Adjust Affirmations</button>
          <button id="custom-puzzle-button" style="
            width: 100%;
            padding: 10px;
            background-color: #F59E0B;
            color: white;
            border: none;
            border-radius: 4px;
            font-size: 14px;
            cursor: pointer;
            font-weight: 500;
            text-transform: uppercase;
            margin-top: 10px;
          ">Custom Puzzle</button>
          <button id="notification-settings-button" style="
            width: 100%;
            padding: 10px;
            background-color: #10B981;
            color: white;
            border: none;
            border-radius: 4px;
            font-size: 14px;
            cursor: pointer;
            font-weight: 500;
            text-transform: uppercase;
            margin-top: 10px;
          ">Notification Settings</button>
        </div>
        <button class="return-to-game-button" onclick="document.getElementById('customize-modal').classList.add('hidden');">Return to Game</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  // Stop propagation on modal content
  const modalContent = modal.querySelector('.bg-white');
  modalContent.addEventListener('click', (e) => {
    e.stopPropagation();
  });

  // Add event listener for button
  customizeButton.addEventListener('click', (e) => {
    e.stopPropagation();
    updateColorSchemesList();
    modal.classList.remove('hidden');
  });
}

// Update the color schemes list in the modal
function updateColorSchemesList() {
  const listContainer = document.getElementById('color-schemes-list');
  if (!listContainer) return;

  const selectedScheme = getSelectedColorScheme();

  listContainer.innerHTML = '';

  // Create scheme options in order
  const schemeOrder = ['START', 'BIRDS', 'RIVER', 'PINKS', 'CARDS', 'TRASH', 'WOODS', 'STARS', 'PARTY', 'BLAST', 'POWER', 'NEONS', 'QUEEN', 'LIGHTS'];

  schemeOrder.forEach(schemeName => {
    const scheme = colorSchemes[schemeName];
    const isUnlocked = isSchemeUnlocked(schemeName);
    const isSelected = selectedScheme === schemeName;

    const schemeOption = document.createElement('div');
    schemeOption.className = 'color-scheme-option';
    schemeOption.style.cssText = `
      padding: 12px;
      border: 2px solid ${isSelected ? '#4CAF50' : '#e5e7eb'};
      border-radius: 8px;
      background-color: ${isSelected ? '#f0fff0' : (isUnlocked ? 'white' : '#f5f5f5')};
      cursor: ${isUnlocked ? 'pointer' : 'not-allowed'};
      opacity: ${isUnlocked ? '1' : '0.7'};
      transition: all 0.2s ease;
    `;

    // Header with title and lock status
    const header = document.createElement('div');
    header.style.cssText = 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;';

    const title = document.createElement('span');
    title.style.cssText = 'font-weight: bold; font-size: 14px;';
    title.textContent = scheme.name;

    header.appendChild(title);

    if (!isUnlocked) {
      const lockInfo = document.createElement('span');
      lockInfo.style.cssText = 'display: flex; align-items: center; gap: 4px; color: #888; font-size: 12px;';

      // Display requirement based on type
      let requirementText;
      if (scheme.requiresShare !== undefined) {
        requirementText = 'Share once';
      } else if (scheme.requiredStreak !== undefined) {
        requirementText = `${scheme.requiredStreak} day streak`;
      } else {
        requirementText = `${scheme.requiredPuzzles} puzzles`;
      }

      lockInfo.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
          <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
        </svg>
        ${requirementText}
      `;
      header.appendChild(lockInfo);
    } else if (isSelected) {
      const checkmark = document.createElement('span');
      checkmark.style.cssText = 'color: #4CAF50; font-weight: bold;';
      checkmark.textContent = '✓ Selected';
      header.appendChild(checkmark);
    }

    schemeOption.appendChild(header);

    // Add "Unlocked in full game" text for premium schemes
    if (!isUnlocked && !isPremium() && schemeName !== 'START' && schemeName !== 'BIRDS' && schemeName !== 'RIVER' && schemeName !== 'PINKS' && schemeName !== 'CARDS') {
      const premiumText = document.createElement('div');
      premiumText.style.cssText = 'font-size: 11px; color: #FF5722; font-weight: 600; margin-bottom: 8px; text-align: center;';
      premiumText.textContent = 'Unlocked in full game';
      schemeOption.appendChild(premiumText);
    }

    // Color swatches
    const swatches = document.createElement('div');
    swatches.style.cssText = 'display: flex; gap: 6px;';

    scheme.colors.forEach(color => {
      const swatch = document.createElement('div');
      swatch.style.cssText = `
        width: 30px;
        height: 30px;
        background-color: ${color};
        border-radius: 4px;
        border: 1px solid rgba(0, 0, 0, 0.2);
        ${!isUnlocked ? 'filter: grayscale(50%);' : ''}
      `;
      swatches.appendChild(swatch);
    });

    schemeOption.appendChild(swatches);

    // Add click handler for unlocked schemes
    if (isUnlocked) {
      schemeOption.addEventListener('click', () => {
        saveSelectedColorScheme(schemeName);
        updateColorSchemesList();
      });

      schemeOption.addEventListener('mouseenter', () => {
        if (!isSelected) {
          schemeOption.style.borderColor = '#90EE90';
        }
      });

      schemeOption.addEventListener('mouseleave', () => {
        if (!isSelected) {
          schemeOption.style.borderColor = '#e5e7eb';
        }
      });
    }

    listContainer.appendChild(schemeOption);
  });
}

// Add global click handler for customize modal
function setupCustomizeModalHandler() {
  document.addEventListener('click', () => {
    const customizeModal = document.getElementById('customize-modal');
    if (customizeModal && !customizeModal.classList.contains('hidden')) {
      customizeModal.classList.add('hidden');
    }
  });
}

// Initialize customization system
document.addEventListener('DOMContentLoaded', () => {
  createCustomizationModal();
  setupCustomizeModalHandler();
  setupAffirmationsButton();
  setupCustomPuzzleButton();
  setupNotificationButton();

  // Sync current game state with Android for notifications
  const stats = getStatistics();
  syncGameStateWithAndroid(stats);
});

// Affirmations System
const defaultAffirmations = [
  'You are so smart!',
  'You win!',
  "That's Wordfive!",
  'You are brilliant!',
  'You did it!',
  'You are amazing!',
  'You are fantastic!',
  'Follow @playwordfive on TikTok, Instagram, and YouTube!',
  'Please review Wordfive on Google Play!',
  '(Write your own message here with the full game!)'
];

// Get affirmations from localStorage
function getAffirmations() {
  const saved = localStorage.getItem('wordfive-affirmations');
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      // Filter out empty strings and check if any valid affirmations exist
      const validAffirmations = parsed.filter(a => a && a.trim() !== '');
      if (validAffirmations.length > 0) {
        return parsed; // Return full array for editing, but we'll filter when selecting
      }
    } catch (e) {
      // If parsing fails, return defaults
    }
  }
  return [...defaultAffirmations];
}

// Save affirmations to localStorage
function saveAffirmations(affirmations) {
  // Check if all affirmations are blank
  const validAffirmations = affirmations.filter(a => a && a.trim() !== '');
  if (validAffirmations.length === 0) {
    // Reset to defaults if all are blank
    localStorage.setItem('wordfive-affirmations', JSON.stringify(defaultAffirmations));
    return defaultAffirmations;
  }
  localStorage.setItem('wordfive-affirmations', JSON.stringify(affirmations));
  return affirmations;
}

// Get a random affirmation (never blank)
function getRandomAffirmation() {
  const affirmations = getAffirmations();
  const validAffirmations = affirmations.filter(a => a && a.trim() !== '');

  if (validAffirmations.length === 0) {
    // Fallback to defaults if somehow all are blank
    return defaultAffirmations[Math.floor(Math.random() * defaultAffirmations.length)];
  }

  return validAffirmations[Math.floor(Math.random() * validAffirmations.length)];
}

// Setup affirmations button click handler
function setupAffirmationsButton() {
  // Wait for the button to be created
  setTimeout(() => {
    const affirmationsButton = document.getElementById('adjust-affirmations-button');
    if (affirmationsButton) {
      affirmationsButton.addEventListener('click', (e) => {
        e.stopPropagation();
        showAffirmationsModal();
      });
    }
  }, 200);
}

// Setup custom puzzle button click handler
function setupCustomPuzzleButton() {
  setTimeout(() => {
    const customPuzzleButton = document.getElementById('custom-puzzle-button');
    if (customPuzzleButton) {
      customPuzzleButton.addEventListener('click', (e) => {
        e.stopPropagation();
        if (!isPremium()) {
          showPremiumRequiredModal('Custom Puzzle');
        } else {
          showCustomPuzzleModal();
        }
      });
    }
  }, 200);
}

// Create and show custom puzzle modal
function showCustomPuzzleModal() {
  // Remove existing modal if present
  const existingModal = document.getElementById('custom-puzzle-modal');
  if (existingModal) {
    existingModal.remove();
  }

  const modal = document.createElement('div');
  modal.id = 'custom-puzzle-modal';
  modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: rgba(0, 0, 0, 0.7);
    z-index: 150;
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
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
    ">
      <h3 style="margin: 0 0 8px 0; font-size: 18px; font-weight: bold;">Custom Puzzle</h3>
      <p style="margin: 0 0 20px 0; color: #666; font-size: 14px; line-height: 1.5;">
        Enter any valid English five-letter word and the game will generate a puzzle using your word.
      </p>
      <input type="text" id="custom-word-input" maxlength="5" autocomplete="off" style="
        width: 100%;
        padding: 12px;
        font-size: 18px;
        text-align: center;
        text-transform: uppercase;
        letter-spacing: 4px;
        border: 2px solid #d1d5db;
        border-radius: 8px;
        box-sizing: border-box;
        margin-bottom: 16px;
      " placeholder="WORDS">
      <div style="display: flex; gap: 10px;">
        <button id="custom-puzzle-cancel" style="
          flex: 1;
          padding: 12px;
          background-color: #6b7280;
          color: white;
          border: none;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
        ">Cancel</button>
        <button id="custom-puzzle-submit" style="
          flex: 1;
          padding: 12px;
          background-color: #F59E0B;
          color: white;
          border: none;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
        ">Submit</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // Auto-uppercase input
  const input = document.getElementById('custom-word-input');
  input.addEventListener('input', (e) => {
    e.target.value = e.target.value.toUpperCase();
  });

  // Focus the input
  setTimeout(() => input.focus(), 100);

  // Cancel button
  document.getElementById('custom-puzzle-cancel').addEventListener('click', () => {
    modal.remove();
  });

  // Submit button
  document.getElementById('custom-puzzle-submit').addEventListener('click', () => {
    const word = input.value.trim().toUpperCase();
    submitCustomPuzzle(word);
  });

  // Allow Enter key to submit
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const word = input.value.trim().toUpperCase();
      submitCustomPuzzle(word);
    }
  });

  // Close on background click
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.remove();
    }
  });
}

// Submit custom puzzle word
function submitCustomPuzzle(word) {
  // Validate word length
  if (word.length !== 5) {
    showToast('Please enter a five-letter word!');
    return;
  }

  // Validate word is in full word list
  if (!wordListFull.includes(word.toLowerCase())) {
    showToast('Please enter a valid five-letter word!');
    return;
  }

  // Try to generate puzzle with this word
  generateCustomPuzzle(word);
}

// Generate puzzle with custom word
function generateCustomPuzzle(customWord) {
  const MAX_ATTEMPTS = 100;
  let attempts = 0;
  let puzzleGenerated = false;

  // Store original word list and use Hard list for custom puzzles
  const originalWordList = state.wordList;
  state.wordList = wordListHard;

  // Create empty grid first
  createEmptyGrid();

  while (!puzzleGenerated && attempts < MAX_ATTEMPTS) {
    attempts++;

    // Reset state for this attempt
    resetFullGameState();

    // Place initial words
    const wordsPlaced = placeInitialWords();

    if (!wordsPlaced) {
      continue;
    }

    // Try to use the custom word as sixth word
    const customWordSuccess = tryCustomSixthWord(customWord);

    if (customWordSuccess) {
      puzzleGenerated = true;
    }
  }

  // Restore original word list
  state.wordList = originalWordList;

  if (!puzzleGenerated) {
    showToast("Sorry, but we couldn't generate a puzzle with that word! Please try another word.");
    return;
  }

  // Fill remaining spaces
  fillRemainingSpaces();

  // Update display
  updateGridDisplay();

  // Reset and resume timer
  resetTimer();
  resumeTimer();

  // Update letter button visibility (for Very Hard mode)
  updateLetterButtonVisibility();

  // Reset letter buttons to show the new puzzle
  resetLetterButtons();

  // Close custom puzzle modal
  const customModal = document.getElementById('custom-puzzle-modal');
  if (customModal) {
    customModal.remove();
  }

  // Close customization modal
  const customizeModal = document.getElementById('customize-modal');
  if (customizeModal) {
    customizeModal.classList.add('hidden');
  }

  // Show success message
  showToast('Puzzle generated! Have fun!');
}

// Try to use a specific word as the sixth word
function tryCustomSixthWord(customWord) {
  const letters = customWord.toUpperCase().split('');
  let letterMatchCount = 0;

  // Check if letters exist in grid
  for (const letter of letters) {
    const letterCount = letters.filter(l => l === letter).length;
    let letterInGridCount = 0;

    state.grid.forEach(row => {
      letterInGridCount += row.filter(l => l.toUpperCase() === letter).length;
    });

    if (letterInGridCount >= letterCount) {
      letterMatchCount++;
    }
  }

  if (letterMatchCount !== 5) {
    return false;
  }

  const skipBack = processLetterLocations(letters.map(l => l.toLowerCase()));

  if (skipBack) {
    return false;
  }

  removeLettersFromGrid();
  updateLetterButtons(letters.map(l => l.toLowerCase()));
  state.finalWordList.push(customWord.toLowerCase());

  return true;
}

// Create and show affirmations modal
function showAffirmationsModal() {
  // Remove existing modal if present
  const existingModal = document.getElementById('affirmations-modal');
  if (existingModal) {
    existingModal.remove();
  }

  const currentAffirmations = getAffirmations();

  const modal = document.createElement('div');
  modal.id = 'affirmations-modal';
  modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: rgba(0, 0, 0, 0.7);
    z-index: 150;
    display: flex;
    align-items: center;
    justify-content: center;
  `;

  let inputsHTML = '';
  for (let i = 0; i < 10; i++) {
    const value = currentAffirmations[i] || '';
    inputsHTML += `
      <input type="text"
        id="affirmation-input-${i}"
        class="affirmation-input"
        value="${value.replace(/"/g, '&quot;')}"
        placeholder="Affirmation ${i + 1}"
        maxlength="50"
        style="
          width: 100%;
          padding: 8px 12px;
          border: 1px solid #d1d5db;
          border-radius: 4px;
          font-size: 14px;
          margin-bottom: 8px;
          box-sizing: border-box;
        "
      />
    `;
  }

  modal.innerHTML = `
    <div style="
      background: white;
      padding: 24px;
      border-radius: 10px;
      max-width: 400px;
      width: 90%;
      max-height: 90vh;
      overflow-y: auto;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
    ">
      <h3 style="margin: 0 0 8px 0; font-size: 18px; font-weight: bold;">Adjust Affirmations</h3>
      <p style="margin: 0 0 16px 0; color: #666; font-size: 13px; line-height: 1.4;">
        Customize the victory messages that appear when you solve a puzzle. Leave blank to skip.
      </p>
      <div style="margin-bottom: 16px;">
        ${inputsHTML}
      </div>
      <div style="display: flex; gap: 10px; flex-direction: column;">
        <button id="save-affirmations-btn" style="
          width: 100%;
          padding: 10px;
          background-color: #4CAF50;
          color: white;
          border: none;
          border-radius: 4px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
        ">Save</button>
        <button id="reset-affirmations-btn" style="
          width: 100%;
          padding: 10px;
          background-color: #f59e0b;
          color: white;
          border: none;
          border-radius: 4px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
        ">Reset to Default</button>
        <button id="cancel-affirmations-btn" style="
          width: 100%;
          padding: 10px;
          background-color: #e5e7eb;
          color: #333;
          border: none;
          border-radius: 4px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
        ">Cancel</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // Add event listeners
  const saveBtn = document.getElementById('save-affirmations-btn');
  const resetBtn = document.getElementById('reset-affirmations-btn');
  const cancelBtn = document.getElementById('cancel-affirmations-btn');

  saveBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const newAffirmations = [];
    for (let i = 0; i < 10; i++) {
      const input = document.getElementById(`affirmation-input-${i}`);
      newAffirmations.push(input.value.trim());
    }
    saveAffirmations(newAffirmations);
    modal.remove();
    showToast('Affirmations saved!');
  });

  resetBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    // Fill inputs with default values
    for (let i = 0; i < 10; i++) {
      const input = document.getElementById(`affirmation-input-${i}`);
      input.value = defaultAffirmations[i] || '';
    }
  });

  cancelBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    modal.remove();
  });

  // Close on background click
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.remove();
    }
  });

  // Prevent clicks inside modal content from closing it
  const modalContent = modal.querySelector('div');
  modalContent.addEventListener('click', (e) => {
    e.stopPropagation();
  });
}

// Notification Settings System
function setupNotificationButton() {
  // Wait for the button to be created
  setTimeout(() => {
    const notificationButton = document.getElementById('notification-settings-button');
    if (notificationButton) {
      notificationButton.addEventListener('click', (e) => {
        e.stopPropagation();
        showNotificationSettingsModal();
      });
    }
  }, 200);
}

function showNotificationSettingsModal() {
  // Remove existing modal if present
  const existingModal = document.getElementById('notification-settings-modal');
  if (existingModal) {
    existingModal.remove();
  }

  // Get current settings from Android
  let isEnabled = true;
  let currentHour = 20;
  let currentMinute = 0;

  if (typeof AndroidNotification !== 'undefined') {
    isEnabled = AndroidNotification.isNotificationEnabled();
    currentHour = AndroidNotification.getNotificationHour();
    currentMinute = AndroidNotification.getNotificationMinute();
  }

  const modal = document.createElement('div');
  modal.id = 'notification-settings-modal';
  modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: rgba(0, 0, 0, 0.7);
    z-index: 150;
    display: flex;
    align-items: center;
    justify-content: center;
  `;

  const hourOptions = Array.from({length: 24}, (_, i) => {
    const selected = i === currentHour ? 'selected' : '';
    const display = i === 0 ? '12 AM' : i < 12 ? `${i} AM` : i === 12 ? '12 PM' : `${i-12} PM`;
    return `<option value="${i}" ${selected}>${display}</option>`;
  }).join('');

  const minuteOptions = ['00', '15', '30', '45'].map(m => {
    const selected = parseInt(m) === currentMinute ? 'selected' : '';
    return `<option value="${m}" ${selected}>${m}</option>`;
  }).join('');

  modal.innerHTML = `
    <div style="
      background: white;
      padding: 24px;
      border-radius: 10px;
      max-width: 400px;
      width: 90%;
      max-height: 90vh;
      overflow-y: auto;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
    ">
      <h3 style="margin: 0 0 8px 0; font-size: 18px; font-weight: bold;">Notification Settings</h3>
      <p style="margin: 0 0 16px 0; color: #666; font-size: 13px; line-height: 1.4;">
        Get a daily reminder to maintain your puzzle streak if you haven't played today. Note: For battery optimization, your notification may not come at the exact time set.
      </p>
      <div style="margin-bottom: 16px;">
        <label style="display: flex; align-items: center; margin-bottom: 16px; cursor: pointer;">
          <input type="checkbox" id="notification-enabled" ${isEnabled ? 'checked' : ''} style="
            width: 20px;
            height: 20px;
            margin-right: 10px;
            cursor: pointer;
          "/>
          <span style="font-size: 14px; font-weight: 500;">Enable daily reminders</span>
        </label>
        <div id="time-settings" style="${isEnabled ? '' : 'opacity: 0.5; pointer-events: none;'}">
          <label style="display: block; margin-bottom: 8px; font-size: 14px; font-weight: 500;">Notification Time</label>
          <div style="display: flex; gap: 8px;">
            <select id="notification-hour" style="
              flex: 1;
              padding: 8px 12px;
              border: 1px solid #d1d5db;
              border-radius: 4px;
              font-size: 14px;
              background-color: white;
            ">
              ${hourOptions}
            </select>
            <select id="notification-minute" style="
              flex: 1;
              padding: 8px 12px;
              border: 1px solid #d1d5db;
              border-radius: 4px;
              font-size: 14px;
              background-color: white;
            ">
              ${minuteOptions}
            </select>
          </div>
        </div>
      </div>
      <div style="display: flex; gap: 10px; flex-direction: column;">
        <button id="save-notification-btn" style="
          width: 100%;
          padding: 10px;
          background-color: #10B981;
          color: white;
          border: none;
          border-radius: 4px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
        ">Save</button>
        <button id="cancel-notification-btn" style="
          width: 100%;
          padding: 10px;
          background-color: #e5e7eb;
          color: #333;
          border: none;
          border-radius: 4px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
        ">Cancel</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // Add event listeners
  const enabledCheckbox = document.getElementById('notification-enabled');
  const timeSettings = document.getElementById('time-settings');
  const saveBtn = document.getElementById('save-notification-btn');
  const cancelBtn = document.getElementById('cancel-notification-btn');

  enabledCheckbox.addEventListener('change', () => {
    if (enabledCheckbox.checked) {
      timeSettings.style.opacity = '1';
      timeSettings.style.pointerEvents = 'auto';
    } else {
      timeSettings.style.opacity = '0.5';
      timeSettings.style.pointerEvents = 'none';
    }
  });

  saveBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const enabled = enabledCheckbox.checked;
    const hour = parseInt(document.getElementById('notification-hour').value);
    const minute = parseInt(document.getElementById('notification-minute').value);

    if (typeof AndroidNotification !== 'undefined') {
      AndroidNotification.setNotificationEnabled(enabled);
      AndroidNotification.setNotificationTime(hour, minute);
      showToast('Notification settings saved!');
    } else {
      showToast('Notification settings only available on Android');
    }

    modal.remove();
  });

  cancelBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    modal.remove();
  });

  // Close on background click
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.remove();
    }
  });

  // Prevent clicks inside modal content from closing it
  const modalContent = modal.querySelector('div');
  modalContent.addEventListener('click', (e) => {
    e.stopPropagation();
  });
}
