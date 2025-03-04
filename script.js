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
  wordPositions: []
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
  showAnswerButton: document.getElementById('show-answer-button'),
  tryNumberfiveButton: document.getElementById('try-numberfive-button')
};

// Load word list
import { wordList } from './wordList.js';

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

      // Check if this is a placed letter that can be removed
      if (cell.classList.contains('player-placed') && state.grid[row][col] !== ' ') {
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
        return;
      }

      // Check if this cell is a valid position for letter placement
      const isValidPosition = state.locsToBlankX.some((x, i) => 
        x === row && state.locsToBlankY[i] === col
      );

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
          checkWinCondition();
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

  // Re-enable all letter buttons
  Object.values(elements.letterButtons).forEach(button => {
    button.disabled = false;
  });

  updateLetterButtonStates();

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
    wordList: [...wordList]
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
}
// Event Listeners
elements.newPuzzleButton.addEventListener('click', () => {
  state.selectedCell = null;
  initializeGame();
  resetLetterButtons();
});

elements.resetButton.addEventListener('click', resetLetterButtons);
elements.showAnswerButton.addEventListener('click', showAnswer);

// Call the main function to initialize
initializeGame();

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

  // Click anywhere outside to close
  document.addEventListener('click', () => {
    const modal = document.getElementById('help-modal');
    if (!modal.classList.contains('hidden')) {
      modal.classList.add('hidden');
    }
  });
}

// Initialize help system
document.addEventListener('DOMContentLoaded', createHelpModal);

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
    bookButton.textContent = 'Get cozy';
    bookButton.addEventListener('click', () => {
        window.open('https://a.co/d/3vR0uk4', '_blank');
    });
  
    // Numberfive button
    const num5Button = document.createElement('button');
    num5Button.className = 'try-numberfive-button';
    num5Button.textContent = 'Try Numberfive!';
    num5Button.addEventListener('click', () => {
        window.open('https://playnumberfive.com', '_blank');
    });

    // Add buttons to container
    buttonContainer.appendChild(shareButton);
    buttonContainer.appendChild(bookButton);
    buttonContainer.appendChild(num5Button);

    // Add container after control buttons
    controlButtons.parentNode.insertBefore(buttonContainer, controlButtons.nextSibling);

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
