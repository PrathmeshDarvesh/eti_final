let questions = [];
let currentQuestion = 0;
let score = 0;
let timeLeft = 30; // 30 seconds per question
let timer;
let userAnswers = []; // Store user's answers for review
let markedQuestions = new Set();
let isReviewMode = false;
let isPracticeMode = false;
let questionStartTime = 0;
let categoryStats = {};
let soundEnabled = true;
let fontSize = 16;
let allQuestions = [];
let selectedQuestions = [];

// Add these variables at the top with your Imgflip credentials
const IMGFLIP_USERNAME = 'PrathmeshDarvesh'; // Add your Imgflip username here
const IMGFLIP_PASSWORD = 'Prathme4140W'; // Add your Imgflip password here

// Theme management
const themeToggle = document.getElementById('theme-toggle');
themeToggle.addEventListener('click', () => {
    const isDark = document.body.getAttribute('data-theme') === 'dark';
    document.body.setAttribute('data-theme', isDark ? 'light' : 'dark');
    themeToggle.innerHTML = isDark ? '<i class="fas fa-moon"></i>' : '<i class="fas fa-sun"></i>';
    localStorage.setItem('theme', isDark ? 'light' : 'dark');
});

// Load saved theme
const savedTheme = localStorage.getItem('theme');
if (savedTheme) {
    document.body.setAttribute('data-theme', savedTheme);
    themeToggle.innerHTML = savedTheme === 'dark' ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
}

// Search functionality
const searchInput = document.getElementById('question-search');
searchInput.addEventListener('input', (e) => {
    const searchTerm = e.target.value.toLowerCase();
    const navButtons = document.querySelectorAll('.nav-btn');
    
    navButtons.forEach((button, index) => {
        const question = questions[index].question.toLowerCase();
        button.style.display = question.includes(searchTerm) ? 'block' : 'none';
    });
});

// Save progress
document.getElementById('save-progress').addEventListener('click', () => {
    const progress = {
        currentQuestion,
        score,
        userAnswers,
        markedQuestions: Array.from(markedQuestions)
    };
    localStorage.setItem('quizProgress', JSON.stringify(progress));
    alert('Progress saved successfully!');
});

// Load progress
function loadProgress() {
    const savedProgress = localStorage.getItem('quizProgress');
    if (savedProgress) {
        const progress = JSON.parse(savedProgress);
        currentQuestion = progress.currentQuestion;
        score = progress.score;
        userAnswers = progress.userAnswers;
        markedQuestions = new Set(progress.markedQuestions || []);
        categoryStats = progress.categoryStats || {};
        timeLeft = progress.timeLeft || 30;
        return true;
    }
    return false;
}

// Review all mode
document.getElementById('review-all').addEventListener('click', () => {
    isReviewMode = true;
    document.body.classList.add('review-mode');
    currentQuestion = 0;
    displayQuestion();
    updateQuestionNav();
});

// Skip question
document.getElementById('skip-btn').addEventListener('click', () => {
    // Clear the timer
    clearInterval(timer);
    
    // Store the skipped answer
    userAnswers.push({
        question: questions[currentQuestion].question,
        userAnswer: 'Skipped',
        correctAnswer: questions[currentQuestion].answer,
        isCorrect: false
    });

    // Update category stats
    const category = questions[currentQuestion].category;
    categoryStats[category].incorrect++;

    // Show feedback for skipped question
    const feedbackContainer = document.getElementById('feedback-container');
    feedbackContainer.innerHTML = `
        <div class="feedback skipped">
            <div class="feedback-icon">
                <i class="fas fa-forward"></i>
            </div>
            <div class="feedback-text">
                Question Skipped
            </div>
            <div class="correct-answer">
                <strong>Correct Answer:</strong> ${questions[currentQuestion].answer}. ${questions[currentQuestion].options[questions[currentQuestion].answer]}
            </div>
        </div>
    `;

    // Disable all options
    document.querySelectorAll('.option').forEach(option => {
        option.style.pointerEvents = 'none';
    });

    // Change submit button to next button
    const submitBtn = document.getElementById('submit-btn');
    submitBtn.textContent = 'Next Question';
    submitBtn.onclick = moveToNextQuestion;

    // Update navigation
    updateQuestionNav();
    updateProgress();
});

// Fetch questions from JSON file
function fetchQuestions() {
    fetch('Purchased_ETI_leak_2024_24_page_questions.json')
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            if (!Array.isArray(data) || data.length === 0) {
                throw new Error('Invalid JSON format or empty questions array');
            }
            
            // Validate and clean questions data
            allQuestions = data.filter(question => {
                // Check if question has all required fields
                if (!question.question || !question.options || !question.answer) {
                    console.warn('Skipping invalid question:', question);
                    return false;
                }

                // Check if options is an object with at least 2 options
                const options = question.options;
                if (typeof options !== 'object' || Object.keys(options).length < 2) {
                    console.warn('Question has invalid options:', question);
                    return false;
                }

                // Check if answer exists in options
                if (!options[question.answer]) {
                    console.warn('Answer not found in options:', question);
                    return false;
                }

                // Remove empty options
                Object.keys(options).forEach(key => {
                    if (!options[key]) {
                        delete options[key];
                    }
                });

                return true;
            });

            if (allQuestions.length === 0) {
                throw new Error('No valid questions found in the data');
            }

            // Add question numbers and default values
            allQuestions = allQuestions.map((q, index) => ({
                ...q,
                question_number: q.question_number || index + 1,
                difficulty: q.difficulty || 'medium',
                marks: q.marks || 1,
                category: q.category || 'Uncategorized',
                page_number: q.page_number || 1 // Add page number support
            }));

            // Update total questions count in the UI
            document.getElementById('total-questions').textContent = allQuestions.length;

            // Show start screen
            showStartScreen();
            hideLoadingSpinner();
        })
        .catch(error => {
            console.error('Error loading questions:', error);
            hideLoadingSpinner();
            document.getElementById('quiz-container').innerHTML = `
                <div class="error">
                    <i class="fas fa-exclamation-circle"></i>
                    <h3>Error Loading Questions</h3>
                    <p>${error.message}</p>
                    <p>Please make sure:</p>
                    <ul>
                        <li>You're running this through a local server</li>
                        <li>The questions.json file is properly formatted</li>
                        <li>Each question has valid options and an answer</li>
                    </ul>
                    <button onclick="location.reload()" class="retry-btn">
                        <i class="fas fa-redo"></i> Retry
                    </button>
                </div>
            `;
        });
}

// Add loading spinner functions
function showLoadingSpinner() {
    document.getElementById('loading-spinner').classList.remove('hidden');
}

function hideLoadingSpinner() {
    document.getElementById('loading-spinner').classList.add('hidden');
}

// Add new function for start screen
function showStartScreen() {
    const quizContainer = document.getElementById('quiz-container');
    
    // Hide other elements initially
    document.getElementById('question-container').style.display = 'none';
    document.getElementById('options-container').style.display = 'none';
    document.getElementById('feedback-container').style.display = 'none';
    document.getElementById('submit-btn').style.display = 'none';
    document.getElementById('sidebar').style.display = 'none';
    
    // Add event listeners for the new buttons
    document.getElementById('random-70-btn').addEventListener('click', () => {
        selectedQuestions = getRandomQuestions(70);
        questions = selectedQuestions; // Update the global questions array
        startQuiz();
    });
    
    document.getElementById('all-questions-btn').addEventListener('click', () => {
        selectedQuestions = [...allQuestions];
        questions = selectedQuestions; // Update the global questions array
        startQuiz();
    });
}

// Add new function to start quiz
function startQuiz() {
    // Show quiz elements
    document.getElementById('question-container').style.display = 'block';
    document.getElementById('options-container').style.display = 'block';
    document.getElementById('feedback-container').style.display = 'block';
    document.getElementById('submit-btn').style.display = 'block';
    document.getElementById('sidebar').style.display = 'block';
    document.getElementById('mark-review-btn').style.display = 'block';
    
    // Hide start screen
    document.getElementById('quiz-container').style.display = 'none';
    
    // Initialize progress
    updateProgress();
    updateQuestionCounts();
    
    // Create question navigation
    createQuestionNav();
    
    // Start the quiz
    displayQuestion();
    startTimer();
    
    // Add keyboard event listeners
    document.addEventListener('keydown', handleKeyboardInput);
}

// Add timer function
function startTimer() {
    const timerDisplay = document.getElementById('timer');
    clearInterval(timer);
    timeLeft = 30;
    timerDisplay.textContent = timeLeft;
    timerDisplay.classList.remove('warning');
    
    timer = setInterval(() => {
        timeLeft--;
        timerDisplay.textContent = timeLeft;
        
        if (timeLeft <= 10) {
            timerDisplay.classList.add('warning');
        }
        
        if (timeLeft <= 0) {
            clearInterval(timer);
            handleTimeout();
        }
    }, 1000);
}

// Add timeout handler
function handleTimeout() {
    const feedbackContainer = document.getElementById('feedback-container');
    const correctAnswer = questions[currentQuestion].answer;
    
    feedbackContainer.innerHTML = `
        <div class="feedback timeout">
            ⏰ Time's Up!
            <div class="correct-answer">
                Correct Answer: ${correctAnswer}. ${questions[currentQuestion].options[correctAnswer]}
            </div>
        </div>
    `;
    
    // Store the timeout answer
    userAnswers.push({
        question: questions[currentQuestion].question,
        userAnswer: 'Timeout',
        correctAnswer: correctAnswer,
        isCorrect: false
    });

    moveToNextQuestion();
}

// Add touch event support
function addTouchSupport() {
    const options = document.querySelectorAll('.option');
    options.forEach(option => {
        option.addEventListener('touchstart', (e) => {
            e.preventDefault();
            selectOption(option);
        });
    });
}

// Update displayQuestion function to include touch support
function displayQuestion() {
    questionStartTime = Date.now();
    const questionContainer = document.getElementById('question-container');
    const optionsContainer = document.getElementById('options-container');
    const question = questions[currentQuestion];
    const nextBtn = document.getElementById('next-btn');
    const submitBtn = document.getElementById('submit-btn');

    if (!question) {
        console.error('Invalid question at index:', currentQuestion);
        return;
    }

    // Update category stats
    if (!categoryStats[question.category]) {
        categoryStats[question.category] = { correct: 0, incorrect: 0, timeSpent: 0 };
    }

    // Clear previous state
    optionsContainer.innerHTML = '';
    document.getElementById('feedback-container').innerHTML = '';
    
    // Check if this question was already answered
    const previousAnswer = userAnswers[currentQuestion];
    
    if (previousAnswer) {
        submitBtn.style.display = 'none';
        nextBtn.style.display = 'block';
        nextBtn.onclick = () => moveToNextQuestion();
    } else {
        submitBtn.style.display = 'block';
        nextBtn.style.display = 'none';
    }

    questionContainer.innerHTML = `
        <div class="progress">
            Question ${currentQuestion + 1} of ${questions.length}
            <span id="timer" class="timer">30</span>
        </div>
        <div class="question">
            <span class="question-number">${question.question_number}.</span>
            <span class="question-text">${question.question}</span>
            ${question.difficulty ? `
                <span class="difficulty-indicator difficulty-${question.difficulty}">
                    ${question.difficulty}
                </span>
            ` : ''}
            ${question.category ? `
                <span class="category-tag">${question.category}</span>
            ` : ''}
            ${question.page_number ? `
                <span class="page-number">Page ${question.page_number}</span>
            ` : ''}
        </div>
    `;

    // Sort options by key (A, B, C, D)
    const options = Object.entries(question.options)
        .filter(([_, value]) => value) // Remove empty options
        .sort(([a], [b]) => a.localeCompare(b));
    
    options.forEach(([key, value]) => {
        const option = document.createElement('div');
        option.className = 'option';
        option.setAttribute('role', 'radio');
        option.setAttribute('aria-checked', 'false');
        option.setAttribute('tabindex', '0');
        option.innerHTML = `
            <span class="option-key">${key}.</span>
            <span class="option-text">${value}</span>
        `;
        
        // If this question was previously answered, show the answer
        if (previousAnswer) {
            option.style.pointerEvents = 'none';
            if (key === previousAnswer.userAnswer) {
                option.classList.add('selected');
                option.setAttribute('aria-checked', 'true');
                if (previousAnswer.isCorrect) {
                    option.classList.add('correct-option');
                } else {
                    option.classList.add('incorrect-option');
                }
            }
            if (key === previousAnswer.correctAnswer) {
                option.classList.add('correct-option');
            }
        } else {
            // Add click, touch, and keyboard event listeners
            option.onclick = () => selectOption(option);
            option.ontouchstart = (e) => {
                e.preventDefault();
                selectOption(option);
            };
            option.onkeydown = (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    selectOption(option);
                }
            };
        }
        
        optionsContainer.appendChild(option);
    });

    // If previously answered, show the feedback
    if (previousAnswer) {
        showFeedback(previousAnswer.isCorrect, previousAnswer.userAnswer, previousAnswer.correctAnswer);
    }

    // Start timer if not previously answered
    if (!previousAnswer) {
        startTimer();
    }

    // Add touch support for buttons
    addTouchSupport();
}

function selectOption(selectedOption) {
    // Remove selected class from all options
    document.querySelectorAll('.option').forEach(option => {
        option.classList.remove('selected');
        option.setAttribute('aria-checked', 'false');
    });

    // Add selected class to clicked option
    selectedOption.classList.add('selected');
    selectedOption.setAttribute('aria-checked', 'true');
}

document.getElementById('submit-btn').addEventListener('click', () => {
    const selectedOption = document.querySelector('.option.selected');
    if (!selectedOption) {
        alert('Please select an answer!');
        return;
    }

    clearInterval(timer);
    // Get the selected answer key (A, B, C, or D)
    const selectedAnswer = selectedOption.querySelector('.option-key').textContent.replace('.', '');
    const correctAnswer = questions[currentQuestion].answer;
    const isCorrect = selectedAnswer === correctAnswer;
    
    // Store user's answer
    userAnswers.push({
        question: questions[currentQuestion].question,
        userAnswer: selectedAnswer,
        correctAnswer: correctAnswer,
        isCorrect: isCorrect
    });

    // Update category stats
    const category = questions[currentQuestion].category;
    if (isCorrect) {
        categoryStats[category].correct++;
        score += questions[currentQuestion].marks || 1;
    } else {
        categoryStats[category].incorrect++;
    }

    showFeedback(isCorrect, selectedAnswer, correctAnswer);
    
    // Hide submit button and show next button
    const submitBtn = document.getElementById('submit-btn');
    const nextBtn = document.getElementById('next-btn');
    submitBtn.style.display = 'none';
    nextBtn.style.display = 'block';
    nextBtn.onclick = () => moveToNextQuestion();
});

// Update showFeedback function to remove meme display
function showFeedback(isCorrect, selectedAnswer, correctAnswer) {
    const feedbackContainer = document.getElementById('feedback-container');
    const question = questions[currentQuestion];
    
    feedbackContainer.innerHTML = `
        <div class="feedback ${isCorrect ? 'correct' : 'incorrect'}">
            <div class="feedback-icon">
                <i class="fas ${isCorrect ? 'fa-check-circle' : 'fa-times-circle'}"></i>
            </div>
            <div class="feedback-text">
                ${isCorrect ? 'Correct!' : 'Incorrect!'}
            </div>
            <div class="correct-answer">
                <strong>Correct Answer:</strong> ${correctAnswer}. ${question.options[correctAnswer]}
            </div>
            ${question.explanation ? `
                <div class="explanation">
                    <strong>Explanation:</strong> ${question.explanation}
                </div>
            ` : ''}
        </div>
    `;

    // Highlight correct and incorrect answers
    document.querySelectorAll('.option').forEach(option => {
        option.style.pointerEvents = 'none';
        const optionLetter = option.querySelector('.option-key').textContent.replace('.', '');
        if (optionLetter === correctAnswer) {
            option.classList.add('correct-option');
        } else if (optionLetter === selectedAnswer && !isCorrect) {
            option.classList.add('incorrect-option');
        }
    });
}

// Add new function to move to next question
function moveToNextQuestion() {
    currentQuestion++;
    
    if (currentQuestion < questions.length) {
        // Reset button states
        const submitBtn = document.getElementById('submit-btn');
        const nextBtn = document.getElementById('next-btn');
        submitBtn.style.display = 'block';
        nextBtn.style.display = 'none';
        
        displayQuestion();
    } else {
        showResult();
    }
}

function showResult() {
    document.getElementById('sidebar').style.display = 'none';
    document.getElementById('quiz-container').classList.add('hidden');
    document.getElementById('result-container').classList.remove('hidden');
    
    const totalMarks = questions.reduce((sum, q) => sum + (q.marks || 1), 0);
    const percentage = (score / totalMarks) * 100;
    
    // Update score display
    document.getElementById('score').textContent = `${score} out of ${totalMarks}`;
    document.getElementById('percentage').textContent = `${percentage.toFixed(1)}%`;
    
    // Calculate statistics
    const correctCount = userAnswers.filter(a => a.isCorrect).length;
    const incorrectCount = userAnswers.filter(a => !a.isCorrect && a.userAnswer !== 'Skipped').length;
    const timeoutCount = userAnswers.filter(a => a.userAnswer === 'Timeout').length;
    const skippedCount = userAnswers.filter(a => a.userAnswer === 'Skipped').length;
    
    // Update statistics dashboard
    document.getElementById('correct-count').textContent = correctCount;
    document.getElementById('incorrect-count').textContent = incorrectCount;
    document.getElementById('timeout-count').textContent = timeoutCount;
    document.getElementById('marked-count').textContent = markedQuestions.size;

    // Update charts
    updateCharts();
    
    // Enhanced review section
    const reviewContainer = document.getElementById('review-container');
    reviewContainer.innerHTML = `
        <h3>Question Review</h3>
        <div class="review-summary">
            <div class="summary-item">
                <i class="fas fa-list-ol"></i>
                <span>Total Questions: ${questions.length}</span>
            </div>
            <div class="summary-item">
                <i class="fas fa-check-circle"></i>
                <span>Correct Answers: ${correctCount}</span>
            </div>
            <div class="summary-item">
                <i class="fas fa-times-circle"></i>
                <span>Incorrect Answers: ${incorrectCount}</span>
            </div>
            <div class="summary-item">
                <i class="fas fa-clock"></i>
                <span>Timeouts: ${timeoutCount}</span>
            </div>
            <div class="summary-item">
                <i class="fas fa-forward"></i>
                <span>Skipped: ${skippedCount}</span>
            </div>
            <div class="summary-item">
                <i class="fas fa-flag"></i>
                <span>Marked for Review: ${markedQuestions.size}</span>
            </div>
        </div>
    `;
    
    // Add review items
    userAnswers.forEach((answer, index) => {
        const isMarked = markedQuestions.has(index);
        const question = questions[index];
        const difficulty = question.difficulty || 'medium';
        const marks = question.marks || 1;
        const category = question.category || 'Uncategorized';
        const timeSpent = categoryStats[category].timeSpent / 1000; // Convert to seconds
        
        reviewContainer.innerHTML += `
            <div class="review-item ${answer.isCorrect ? 'correct' : 'incorrect'} ${isMarked ? 'marked' : ''}">
                <div class="review-header">
                    <span class="question-number">Q${index + 1}</span>
                    <span class="difficulty-indicator difficulty-${difficulty}">${difficulty}</span>
                    <span class="category-tag">${category}</span>
                    <span class="marks">${marks} mark${marks > 1 ? 's' : ''}</span>
                    <span class="time-spent">Time: ${timeSpent.toFixed(1)}s</span>
                </div>
                <p class="question-text">${answer.question}</p>
                <div class="answer-details">
                    <p class="user-answer ${answer.isCorrect ? 'correct' : 'incorrect'}">
                        <i class="fas ${answer.isCorrect ? 'fa-check' : 'fa-times'}"></i>
                        Your Answer: ${answer.userAnswer}
                    </p>
                    <p class="correct-answer">
                        <i class="fas fa-check-circle"></i>
                        Correct Answer: ${answer.correctAnswer}
                    </p>
                </div>
                ${isMarked ? '<p class="marked-note"><i class="fas fa-flag"></i> Marked for Review</p>' : ''}
                ${question.explanation ? `
                    <div class="explanation">
                        <h4>Explanation:</h4>
                        <p>${question.explanation}</p>
                    </div>
                ` : ''}
            </div>
        `;
    });
}

document.getElementById('restart-btn').addEventListener('click', () => {
    // Reset all variables
    currentQuestion = 0;
    score = 0;
    userAnswers = [];
    
    // Reset containers
    document.getElementById('quiz-container').style.display = 'block';
    document.getElementById('result-container').classList.add('hidden');
    
    // Show start screen again
    showStartScreen();
});

// Add this function to create the question navigation
function createQuestionNav() {
    const navContainer = document.getElementById('question-nav');
    navContainer.innerHTML = '';
    
    questions.forEach((_, index) => {
        const button = document.createElement('button');
        button.className = 'nav-btn';
        button.textContent = index + 1;
        button.onclick = () => navigateToQuestion(index);
        navContainer.appendChild(button);
    });
}

// Add this function to handle question navigation
function navigateToQuestion(index) {
    if (index === currentQuestion) return;
    
    currentQuestion = index;
    displayQuestion();
    updateProgress();
    updateQuestionNav();
}

function updateProgress() {
    const progress = (currentQuestion / questions.length) * 100;
    document.getElementById('progress-bar').style.width = `${progress}%`;
}

function updateQuestionCounts() {
    const attempted = userAnswers.length;
    const remaining = questions.length - attempted;
    document.getElementById('attempted-count').textContent = attempted;
    document.getElementById('remaining-count').textContent = remaining;
}

// Update keyboard shortcuts for mobile
function handleKeyboardInput(event) {
    // Only handle keyboard input if not on mobile
    if ('ontouchstart' in window) return;

    if (event.key >= '1' && event.key <= '4') {
        const options = document.querySelectorAll('.option');
        const index = parseInt(event.key) - 1;
        if (options[index]) {
            selectOption(options[index]);
        }
    } else if (event.key === ' ') {
        const submitBtn = document.getElementById('submit-btn');
        if (submitBtn) submitBtn.click();
    } else if (event.key === 'n' || event.key === 'N') {
        const nextBtn = document.getElementById('next-btn');
        if (nextBtn) nextBtn.click();
    } else if (event.key === 's' || event.key === 'S') {
        const skipBtn = document.getElementById('skip-btn');
        if (skipBtn) skipBtn.click();
    } else if (event.key === 'm' || event.key === 'M') {
        const markBtn = document.getElementById('mark-review-btn');
        if (markBtn) markBtn.click();
    } else if (event.key === 'h' || event.key === 'H') {
        const hintBtn = document.getElementById('hint-btn');
        if (hintBtn) hintBtn.click();
    }
}

// Add mark for review functionality
document.getElementById('mark-review-btn').addEventListener('click', () => {
    if (markedQuestions.has(currentQuestion)) {
        markedQuestions.delete(currentQuestion);
    } else {
        markedQuestions.add(currentQuestion);
    }
    
    // Save the updated marked questions state
    saveProgress();
    
    updateQuestionNav();
    
    const feedbackContainer = document.getElementById('feedback-container');
    feedbackContainer.innerHTML = `
        <div class="feedback marked">
            <i class="fas ${markedQuestions.has(currentQuestion) ? 'fa-flag' : 'fa-flag-slash'}"></i>
            Question ${markedQuestions.has(currentQuestion) ? 'marked' : 'unmarked'} for review
        </div>
    `;
});

function updateQuestionNav() {
    const buttons = document.querySelectorAll('.nav-btn');
    buttons.forEach((button, index) => {
        button.className = 'nav-btn';
        if (index === currentQuestion) {
            button.classList.add('current');
        }
        if (userAnswers[index]) {
            button.classList.add('attempted');
        }
        if (markedQuestions.has(index)) {
            button.classList.add('marked');
            button.innerHTML = `<i class="fas fa-flag"></i> ${index + 1}`;
        } else {
            button.textContent = index + 1;
        }
    });
}

// Initialize accessibility controls
function initAccessibility() {
    // Font size controls
    document.getElementById('font-size-increase').addEventListener('click', () => {
        fontSize = Math.min(fontSize + 2, 24);
        document.body.style.fontSize = `${fontSize}px`;
        localStorage.setItem('fontSize', fontSize);
    });

    document.getElementById('font-size-decrease').addEventListener('click', () => {
        fontSize = Math.max(fontSize - 2, 12);
        document.body.style.fontSize = `${fontSize}px`;
        localStorage.setItem('fontSize', fontSize);
    });

    // High contrast toggle
    document.getElementById('high-contrast-toggle').addEventListener('click', () => {
        const isHighContrast = document.body.getAttribute('data-theme') === 'high-contrast';
        document.body.setAttribute('data-theme', isHighContrast ? 'light' : 'high-contrast');
        localStorage.setItem('highContrast', !isHighContrast);
    });

    // Sound toggle
    document.getElementById('sound-toggle').addEventListener('click', () => {
        soundEnabled = !soundEnabled;
        document.getElementById('sound-toggle').innerHTML = 
            `<i class="fas fa-volume-${soundEnabled ? 'up' : 'mute'}"></i>`;
        localStorage.setItem('soundEnabled', soundEnabled);
    });

    // Load saved preferences
    const savedFontSize = localStorage.getItem('fontSize');
    if (savedFontSize) {
        fontSize = parseInt(savedFontSize);
        document.body.style.fontSize = `${fontSize}px`;
    }

    const savedHighContrast = localStorage.getItem('highContrast');
    if (savedHighContrast === 'true') {
        document.body.setAttribute('data-theme', 'high-contrast');
    }

    const savedSound = localStorage.getItem('soundEnabled');
    if (savedSound === 'false') {
        soundEnabled = false;
        document.getElementById('sound-toggle').innerHTML = '<i class="fas fa-volume-mute"></i>';
    }
}

// Initialize analytics
function initAnalytics() {
    // Category performance chart
    const categoryCtx = document.getElementById('category-chart').getContext('2d');
    new Chart(categoryCtx, {
        type: 'bar',
        data: {
            labels: [],
            datasets: [{
                label: 'Correct Answers',
                data: [],
                backgroundColor: 'rgba(40, 167, 69, 0.5)',
                borderColor: 'rgb(40, 167, 69)',
                borderWidth: 1
            }, {
                label: 'Incorrect Answers',
                data: [],
                backgroundColor: 'rgba(220, 53, 69, 0.5)',
                borderColor: 'rgb(220, 53, 69)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });

    // Time per question chart
    const timeCtx = document.getElementById('time-chart').getContext('2d');
    new Chart(timeCtx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: 'Time Spent (seconds)',
                data: [],
                borderColor: 'rgb(0, 123, 255)',
                tension: 0.1
            }]
        },
        options: {
            responsive: true,
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });
}

// Practice mode
function togglePracticeMode() {
    isPracticeMode = !isPracticeMode;
    document.body.classList.toggle('practice-mode');
    document.getElementById('practice-mode').innerHTML = 
        `<i class="fas fa-graduation-cap"></i> ${isPracticeMode ? 'Exit Practice' : 'Practice Mode'}`;
    
    if (isPracticeMode) {
        // Reset current question
        currentQuestion = 0;
        displayQuestion();
    }
}

// Save progress function
function saveProgress() {
    const progress = {
        currentQuestion,
        score,
        userAnswers,
        markedQuestions: Array.from(markedQuestions),
        categoryStats,
        timeLeft,
        questionStartTime: Date.now()
    };
    localStorage.setItem('quizProgress', JSON.stringify(progress));
}

// Break timer
function startBreak() {
    const breakModal = document.getElementById('break-modal');
    const breakSettings = breakModal.querySelector('.break-settings');
    const breakTimerContainer = breakModal.querySelector('.break-timer-container');
    
    // Show the modal with settings
    breakModal.classList.remove('hidden');
    breakSettings.classList.remove('hidden');
    breakTimerContainer.classList.add('hidden');
    
    // Save current progress
    saveProgress();

    // Pause the main timer if it's running
    clearInterval(timer);

    // Handle start break button click
    document.getElementById('start-break-timer').addEventListener('click', () => {
        const duration = parseInt(document.getElementById('break-duration').value);
        if (isNaN(duration) || duration < 1 || duration > 60) {
            alert('Please enter a valid break duration between 1 and 60 minutes.');
            return;
        }

        // Hide settings and show timer
        breakSettings.classList.add('hidden');
        breakTimerContainer.classList.remove('hidden');

        // Start break timer
        startBreakTimer(duration);
    }, { once: true });
}

function startBreakTimer(durationInMinutes) {
    const breakTime = document.getElementById('break-time');
    let timeLeft = durationInMinutes * 60; // Convert minutes to seconds

    // Update break time display
    const updateBreakTime = () => {
        const minutes = Math.floor(timeLeft / 60);
        const seconds = timeLeft % 60;
        breakTime.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    };

    // Initial display
    updateBreakTime();

    // Start break timer
    const breakTimer = setInterval(() => {
        timeLeft--;
        updateBreakTime();

        if (timeLeft <= 0) {
            clearInterval(breakTimer);
            endBreak();
        }
    }, 1000);

    // Resume button handler
    document.getElementById('resume-btn').addEventListener('click', () => {
        clearInterval(breakTimer);
        endBreak();
    }, { once: true });

    // Add keyboard shortcut to resume
    const handleBreakKeyPress = (e) => {
        if (e.key === 'Escape' || e.key === 'Enter') {
            clearInterval(breakTimer);
            endBreak();
        }
    };
    document.addEventListener('keydown', handleBreakKeyPress);

    // Clean up event listener when break ends
    const breakModal = document.getElementById('break-modal');
    breakModal.addEventListener('transitionend', () => {
        if (breakModal.classList.contains('hidden')) {
            document.removeEventListener('keydown', handleBreakKeyPress);
        }
    });
}

function endBreak() {
    const breakModal = document.getElementById('break-modal');
    const breakSettings = breakModal.querySelector('.break-settings');
    const breakTimerContainer = breakModal.querySelector('.break-timer-container');
    
    // Hide modal
    breakModal.classList.add('hidden');
    
    // Reset modal state for next use
    setTimeout(() => {
        breakSettings.classList.remove('hidden');
        breakTimerContainer.classList.add('hidden');
    }, 300);

    // Resume the quiz
    startTimer();
}

// Hint system
function showHint() {
    const question = questions[currentQuestion];
    if (!question.hint) return;

    const hintModal = document.getElementById('hint-modal');
    const hintText = document.getElementById('hint-text');
    
    hintText.textContent = question.hint;
    hintModal.classList.remove('hidden');

    document.getElementById('close-hint').onclick = () => {
        hintModal.classList.add('hidden');
    };
}

// Export results
function exportResults() {
    const results = {
        score,
        totalQuestions: questions.length,
        percentage: (score / questions.length) * 100,
        answers: userAnswers,
        timeSpent: questionStartTime ? Date.now() - questionStartTime : 0,
        categoryStats
    };

    const blob = new Blob([JSON.stringify(results, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `quiz-results-${new Date().toISOString()}.json`;
    a.click();
    URL.revokeObjectURL(url);
}

// Share results
function shareResults() {
    const text = `I scored ${score} out of ${questions.length} (${((score / questions.length) * 100).toFixed(1)}%) on the MCQ Test!`;
    
    if (navigator.share) {
        navigator.share({
            title: 'MCQ Test Results',
            text: text
        });
    } else {
        // Fallback for browsers that don't support Web Share API
        const textarea = document.createElement('textarea');
        textarea.value = text;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        alert('Results copied to clipboard!');
    }
}

// Update charts
function updateCharts() {
    // Update category chart
    const categoryCtx = document.getElementById('category-chart').getContext('2d');
    new Chart(categoryCtx, {
        type: 'bar',
        data: {
            labels: Object.keys(categoryStats),
            datasets: [{
                label: 'Correct Answers',
                data: Object.values(categoryStats).map(stats => stats.correct),
                backgroundColor: 'rgba(40, 167, 69, 0.5)',
                borderColor: 'rgb(40, 167, 69)',
                borderWidth: 1
            }, {
                label: 'Incorrect Answers',
                data: Object.values(categoryStats).map(stats => stats.incorrect),
                backgroundColor: 'rgba(220, 53, 69, 0.5)',
                borderColor: 'rgb(220, 53, 69)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Number of Answers'
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: 'Categories'
                    }
                }
            }
        }
    });

    // Update time chart
    const timeCtx = document.getElementById('time-chart').getContext('2d');
    new Chart(timeCtx, {
        type: 'line',
        data: {
            labels: Object.keys(categoryStats),
            datasets: [{
                label: 'Time Spent (seconds)',
                data: Object.values(categoryStats).map(stats => stats.timeSpent / 1000),
                borderColor: 'rgb(0, 123, 255)',
                tension: 0.1,
                fill: true,
                backgroundColor: 'rgba(0, 123, 255, 0.1)'
            }]
        },
        options: {
            responsive: true,
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Time (seconds)'
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: 'Categories'
                    }
                }
            }
        }
    });
}

// Add swipe support for navigation
let touchStartX = 0;
let touchEndX = 0;

document.addEventListener('touchstart', (e) => {
    touchStartX = e.changedTouches[0].screenX;
});

document.addEventListener('touchend', (e) => {
    touchEndX = e.changedTouches[0].screenX;
    handleSwipe();
});

function handleSwipe() {
    const swipeThreshold = 50;
    const swipeDistance = touchEndX - touchStartX;

    if (Math.abs(swipeDistance) < swipeThreshold) return;

    if (swipeDistance > 0) {
        // Swipe right - go to previous question
        if (currentQuestion > 0) {
            currentQuestion--;
            displayQuestion();
        }
    } else {
        // Swipe left - go to next question
        if (currentQuestion < questions.length - 1) {
            moveToNextQuestion();
        }
    }
}

// Update init function to remove meme template fetching
function init() {
    // Check if device is mobile
    const isMobile = 'ontouchstart' in window;
    
    // Add mobile-specific classes
    if (isMobile) {
        document.body.classList.add('mobile-device');
    }

    // Initialize the rest of the application
    initAccessibility();
    initAnalytics();
    
    // Add event listeners
    document.getElementById('hint-btn').addEventListener('click', showHint);
    document.getElementById('export-results').addEventListener('click', exportResults);
    document.getElementById('share-results').addEventListener('click', shareResults);
    document.getElementById('take-break').addEventListener('click', startBreak);

    // Load questions
    showLoadingSpinner();
    fetchQuestions();
}

// Start the application
init();

const burger = document.getElementById('burger-menu');
const sidebar = document.querySelector('.sidebar');
const overlay = document.getElementById('sidebar-overlay');

burger.addEventListener('click', () => {
  sidebar.classList.add('open');
  overlay.classList.add('active');
});

overlay.addEventListener('click', () => {
  sidebar.classList.remove('open');
  overlay.classList.remove('active');
});

// Add new function to randomize questions
function getRandomQuestions(count) {
    const shuffled = [...allQuestions].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count);
}