// Summer Reading Challenge 105 Days - Core Application Code

// --- STATE DEFINITIONS ---
let state = {
  dailyMinPages: 10,
  startDate: "2026-06-01", // Defaults to June 1, 2026 (local time)
  books: [],
  logs: {}, // Format: { "YYYY-MM-DD": number }
  currentBookId: null,
  completedReviews: [] // Cache of finished books with summaries
};

// Rollover Queue to handle multi-book complete scenarios
let rolloverPagesQueue = 0;

// --- UTILITIES & STORAGE ---
const STORAGE_KEY = "SUMMER_READING_CHALLENGE_105_DAYS_STATE";

// ---- FIREBASE SAQLASH ----
async function saveToFirebase() {
  try {
    const docRef = getUserDocRef();
    if (!docRef) return; // Foydalanuvchi kirmagan bo'lsa, o'tkazib yuboramiz
    await docRef.set({ state: JSON.stringify(state), updatedAt: new Date().toISOString() });
  } catch (e) {
    console.warn("Firebase saqlashda xatolik (localStorage ishlatiladi):", e);
  }
}

async function loadFromFirebase() {
  try {
    const docRef = getUserDocRef();
    if (!docRef) return false;
    const doc = await docRef.get();
    if (doc.exists && doc.data().state) {
      state = JSON.parse(doc.data().state);
      syncReviewsFromBooks();
      // Mahalliy nusxani ham yangilash (offline uchun)
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      return true;
    }
    return false;
  } catch (e) {
    console.warn("Firebase yuklashda xatolik (localStorage'ga qaytildi):", e);
    return false;
  }
}

// ---- ASOSIY SAQLASH FUNKSIYASI (Firebase + localStorage zaxira) ----
function saveToLocalStorage() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  saveToFirebase(); // Firebase ga ham yuborish (async, bloklamaydi)
}

function loadFromLocalStorage() {
  const data = localStorage.getItem(STORAGE_KEY);
  if (data) {
    try {
      state = JSON.parse(data);
      syncReviewsFromBooks();
      return true;
    } catch (e) {
      console.error("Error loading state from localStorage", e);
      return false;
    }
  }
  return false;
}

// ---- AUTH HOLAT KO'RSATGICHI ----
function updateAuthUI(user) {
  const loginBtn = document.getElementById("auth-login-btn");
  const logoutBtn = document.getElementById("auth-logout-btn");
  const userInfo = document.getElementById("auth-user-info");
  if (!loginBtn || !logoutBtn) return;

  if (user) {
    loginBtn.classList.add("hidden");
    logoutBtn.classList.remove("hidden");
    if (userInfo) {
      userInfo.textContent = user.email || user.displayName || "Foydalanuvchi";
      userInfo.classList.remove("hidden");
    }
  } else {
    loginBtn.classList.remove("hidden");
    logoutBtn.classList.add("hidden");
    if (userInfo) userInfo.classList.add("hidden");
  }
}

function loginWithGoogle() {
  const provider = new firebase.auth.GoogleAuthProvider();
  auth.signInWithPopup(provider).catch(e => alert("Kirish xatoligi: " + e.message));
}

function logoutUser() {
  auth.signOut().then(() => {
    // Sahifani yangilash — mahalliy ma'lumotlar saqlanib qoladi
    location.reload();
  });
}

function syncReviewsFromBooks() {
  // Extract completed books and make sure they are in the reviews
  const completedBooks = state.books.filter(b => b.status === 'completed');
  state.completedReviews = completedBooks.map(b => ({
    id: b.id,
    title: b.title,
    rating: b.rating || 5,
    review: b.review || "Ajoyib kitob!",
    completedDate: b.completedDate || new Date().toISOString().split('T')[0]
  }));
}

// --- CALENDAR DATE UTILS ---
function getDatesArray() {
  const dates = [];
  const start = new Date(state.startDate);
  for (let i = 0; i < 105; i++) {
    const nextDate = new Date(start);
    nextDate.setDate(start.getDate() + i);
    const dateStr = nextDate.toISOString().split('T')[0];
    dates.push(dateStr);
  }
  return dates;
}

function formatDateDisplay(dateStr) {
  const date = new Date(dateStr);
  const monthsUz = ["Yan", "Fev", "Mar", "Apr", "May", "Iyun", "Iyul", "Avg", "Sen", "Okt", "Noy", "Dek"];
  return `${date.getDate()} ${monthsUz[date.getMonth()]}`;
}

// --- STATISTICS CALCULATOR ---
function calculateStats() {
  const dates = getDatesArray();
  let totalPagesRead = 0;
  let loggedDaysCount = 0;
  
  // Calculate total pages from logged days
  Object.values(state.logs).forEach(pages => {
    if (pages && pages > 0) {
      totalPagesRead += pages;
    }
  });

  // Count challenge progress percentage (days logged / 105)
  const challengeDaysWithLogs = dates.filter(d => state.logs[d] !== undefined).length;
  const challengeProgressPercent = Math.round((challengeDaysWithLogs / 105) * 100);

  // Total completed books
  const completedBooksCount = state.books.filter(b => b.status === 'completed').length;

  // Streak calculations (consecutive days with pages > 0)
  // Let's sort all log dates that have page count > 0
  const activeLogDates = Object.keys(state.logs)
    .filter(dateStr => state.logs[dateStr] > 0)
    .sort();

  let currentStreak = 0;
  let maxStreak = 0;
  
  if (activeLogDates.length > 0) {
    let tempStreak = 1;
    let streaks = [];
    
    for (let i = 1; i < activeLogDates.length; i++) {
      const prev = new Date(activeLogDates[i-1]);
      const curr = new Date(activeLogDates[i]);
      const diffTime = Math.abs(curr - prev);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      if (diffDays === 1) {
        tempStreak++;
      } else if (diffDays > 1) {
        streaks.push(tempStreak);
        tempStreak = 1;
      }
    }
    streaks.push(tempStreak);
    maxStreak = Math.max(...streaks);

    // Calculate current streak relative to today
    const todayStr = new Date().toISOString().split('T')[0];
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    const hasReadToday = state.logs[todayStr] > 0;
    const hasReadYesterday = state.logs[yesterdayStr] > 0;

    if (hasReadToday || hasReadYesterday) {
      // Trace backwards from today or yesterday
      let traceDate = hasReadToday ? new Date() : yesterday;
      currentStreak = 0;
      while (true) {
        const traceStr = traceDate.toISOString().split('T')[0];
        if (state.logs[traceStr] > 0) {
          currentStreak++;
          traceDate.setDate(traceDate.getDate() - 1);
        } else {
          break;
        }
      }
    } else {
      currentStreak = 0;
    }
  }

  // Remaining days (of the 105 day challenge, relative to start date)
  const today = new Date();
  const start = new Date(state.startDate);
  const end = new Date(start);
  end.setDate(start.getDate() + 105);
  
  let remainingDays = 0;
  if (today < start) {
    remainingDays = 105;
  } else if (today > end) {
    remainingDays = 0;
  } else {
    const diffTime = Math.abs(end - today);
    remainingDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  // Remaining pages of planned / currently reading books
  let totalRemainingPages = 0;
  state.books.forEach(b => {
    if (b.status !== 'completed') {
      totalRemainingPages += (b.totalPages - b.readPages);
    }
  });

  return {
    totalPagesRead,
    completedBooksCount,
    challengeProgressPercent,
    currentStreak,
    maxStreak,
    remainingDays,
    totalRemainingPages
  };
}

// --- SYSTEM RENDERING ---

function renderApp() {
  renderStats();
  renderTracker();
  renderBooks();
  renderReviews();
}

function renderStats() {
  const stats = calculateStats();
  
  // DOM targets
  document.getElementById("stat-total-pages").innerText = stats.totalPagesRead;
  document.getElementById("stat-completed-books").innerText = stats.completedBooksCount;
  document.getElementById("stat-challenge-progress").innerText = `${stats.challengeProgressPercent}%`;
  document.getElementById("stat-challenge-bar").style.width = `${stats.challengeProgressPercent}%`;
  document.getElementById("stat-streak").innerText = `${stats.currentStreak} kun`;
  document.getElementById("stat-max-streak").innerText = `${stats.maxStreak} kun`;
  document.getElementById("stat-remaining-days").innerText = stats.remainingDays;
  document.getElementById("stat-remaining-pages").innerText = stats.totalRemainingPages;
}

function renderTracker() {
  const trackerBody = document.getElementById("tracker-grid-body");
  if (!trackerBody) return;
  trackerBody.innerHTML = "";

  const dates = getDatesArray();
  
  for (let week = 0; week < 15; week++) {
    const row = document.createElement("tr");
    row.className = "border-b border-pink-100/30 hover:bg-pink-50/10 dark:hover:bg-purple-950/15";
    
    // Week label cell
    const weekCell = document.createElement("td");
    weekCell.className = "py-3 px-2 text-center font-bold text-sm text-pink-500 dark:text-purple-300 font-serif whitespace-nowrap border-r border-pink-100/20";
    weekCell.innerText = `${week + 1}-hafta`;
    row.appendChild(weekCell);

    // 7 Days cells
    for (let day = 0; day < 7; day++) {
      const index = week * 7 + day;
      const dateStr = dates[index];
      const pages = state.logs[dateStr];
      
      const dayCell = document.createElement("td");
      dayCell.className = "p-1.5 text-center border-r border-pink-100/20 last:border-r-0";
      
      const cellDiv = document.createElement("div");
      cellDiv.className = "tracker-cell ";
      
      // Determine color status
      if (pages === undefined || pages === null) {
        cellDiv.className += "tracker-cell-empty";
      } else if (pages >= state.dailyMinPages) {
        cellDiv.className += "tracker-cell-success";
      } else {
        cellDiv.className += "tracker-cell-danger";
      }

      // Inside cell layout
      const dateLabel = document.createElement("span");
      dateLabel.className = "font-medium opacity-80 select-none text-[10px]";
      dateLabel.innerText = formatDateDisplay(dateStr);
      cellDiv.appendChild(dateLabel);

      const pagesLabel = document.createElement("span");
      pagesLabel.className = "font-bold text-xs mt-0.5";
      pagesLabel.innerText = pages !== undefined ? `${pages} bet` : "—";
      cellDiv.appendChild(pagesLabel);

      cellDiv.onclick = () => openLogModal(dateStr);
      dayCell.appendChild(cellDiv);
      row.appendChild(dayCell);
    }
    
    trackerBody.appendChild(row);
  }
}

function renderBooks() {
  const completedList = document.getElementById("books-completed-list");
  const readingContainer = document.getElementById("books-reading-container");
  const plannedList = document.getElementById("books-planned-list");

  if (completedList) completedList.innerHTML = "";
  if (plannedList) plannedList.innerHTML = "";

  let activeBookRendered = false;

  state.books.forEach(book => {
    const progress = Math.min(100, Math.round((book.readPages / book.totalPages) * 100));
    
    if (book.status === 'completed') {
      // Completed - Green
      if (completedList) {
        const div = document.createElement("div");
        div.className = "book-card-completed p-4 rounded-2xl mb-3 border border-pink-100/30 glass-panel";
        div.innerHTML = `
          <div class="flex justify-between items-start">
            <div>
              <h4 class="font-bold text-sm text-lime-600 dark:text-lime-400 font-serif flex items-center gap-1.5">
                <span>🌸</span> ${book.title}
              </h4>
              <p class="text-xs text-muted-foreground mt-0.5">${book.totalPages} betlik kitob tugatildi</p>
            </div>
            <span class="bg-lime-500/20 text-lime-700 dark:text-lime-300 text-[10px] font-bold px-2 py-0.5 rounded-full">100%</span>
          </div>
          <div class="w-full bg-lime-100 dark:bg-lime-950/40 h-2.5 rounded-full mt-3 overflow-hidden">
            <div class="bg-lime-500 h-full rounded-full" style="width: 100%"></div>
          </div>
        `;
        completedList.appendChild(div);
      }
    } else if (book.status === 'reading') {
      // Currently reading - Yellow
      activeBookRendered = true;
      if (readingContainer) {
        readingContainer.innerHTML = `
          <div class="book-card-reading p-5 rounded-2xl glass-panel relative overflow-hidden border border-yellow-200/50">
            <div class="absolute -right-6 -bottom-6 text-7xl opacity-10 pointer-events-none select-none">📖</div>
            <div class="flex justify-between items-start mb-2">
              <div>
                <span class="bg-yellow-500/10 text-yellow-700 dark:text-yellow-300 text-[10px] uppercase tracking-wider font-extrabold px-2 py-0.5 rounded-full border border-yellow-300/30">Hozir o'qilyapti</span>
                <h4 class="font-bold text-lg mt-2 font-serif text-yellow-800 dark:text-yellow-300">${book.title}</h4>
              </div>
              <span class="bg-yellow-500/20 text-yellow-800 dark:text-yellow-300 text-xs font-bold px-2.5 py-1 rounded-full">${progress}%</span>
            </div>
            <div class="flex justify-between text-xs text-muted-foreground mt-3 font-medium">
              <span>O'qildi: <strong>${book.readPages}</strong> bet</span>
              <span>Jami: <strong>${book.totalPages}</strong> bet</span>
            </div>
            <div class="w-full bg-yellow-100 dark:bg-yellow-950/40 h-3 rounded-full mt-2.5 overflow-hidden">
              <div class="progress-bar-fill h-full rounded-full" style="width: ${progress}%; background: linear-gradient(90deg, #f59e0b, #fbbf24)"></div>
            </div>
          </div>
        `;
      }
    } else {
      // Planned - Red/Coral
      if (plannedList) {
        const div = document.createElement("div");
        div.className = "book-card-planned p-4 rounded-2xl mb-3 border border-pink-100/30 glass-panel";
        div.innerHTML = `
          <div class="flex justify-between items-start">
            <div>
              <h4 class="font-bold text-sm text-rose-500 dark:text-rose-300 font-serif flex items-center gap-1.5">
                <span>📚</span> ${book.title}
              </h4>
              <p class="text-xs text-muted-foreground mt-0.5">Jami betlar: <strong>${book.totalPages}</strong></p>
            </div>
            <span class="bg-rose-500/10 text-rose-600 dark:text-rose-400 text-[10px] font-bold px-2.5 py-0.5 rounded-full border border-rose-200/20">Rejada</span>
          </div>
          <div class="w-full bg-rose-100 dark:bg-rose-950/40 h-2 rounded-full mt-3 overflow-hidden">
            <div class="bg-rose-400 h-full rounded-full" style="width: 0%"></div>
          </div>
        `;
        plannedList.appendChild(div);
      }
    }
  });

  // If no currently reading book, present an alert in the container
  if (!activeBookRendered && readingContainer) {
    readingContainer.innerHTML = `
      <div class="p-6 rounded-2xl glass-panel text-center border border-dashed border-pink-200 flex flex-col items-center">
        <p class="text-sm text-muted-foreground mb-4">Ayni paytda o'qiyotgan kitobingiz yo'q.</p>
        <button onclick="openNextBookSelectionModal(0)" class="btn-primary text-xs px-4 py-2 flex items-center gap-1.5">
          <i data-lucide="plus-circle" class="w-4 h-4"></i> Kitobni faollashtirish
        </button>
      </div>
    `;
    lucide.createIcons();
  }
}

function renderReviews() {
  const reviewsContainer = document.getElementById("reviews-container");
  if (!reviewsContainer) return;
  reviewsContainer.innerHTML = "";

  if (state.completedReviews.length === 0) {
    reviewsContainer.innerHTML = `
      <div class="p-6 text-center text-xs text-muted-foreground bg-white/30 dark:bg-black/20 rounded-2xl border border-pink-100/10">
        Hozircha tugatilgan kitoblar yo'q. Kitobni tamomlang va ilk xulosangizni yozing! 🌸
      </div>
    `;
    return;
  }

  // Render list of reviews
  state.completedReviews.forEach(review => {
    const card = document.createElement("div");
    card.className = "glass-panel p-5 rounded-2xl mb-4 border border-pink-100/30 flex flex-col justify-between shadow-sm hover:shadow-md transition-all duration-300 relative overflow-hidden";
    
    // Heart icons based on rating
    let hearts = "";
    for (let i = 1; i <= 5; i++) {
      if (i <= review.rating) {
        hearts += "💖";
      } else {
        hearts += "🤍";
      }
    }

    card.innerHTML = `
      <div class="absolute -right-3 -top-3 text-5xl opacity-5 select-none pointer-events-none">✨</div>
      <div class="mb-3">
        <div class="flex justify-between items-center mb-1">
          <h4 class="font-serif font-bold text-sm text-pink-600 dark:text-purple-300 limit-1-line">${review.title}</h4>
          <span class="text-[9px] text-muted-foreground whitespace-nowrap">${review.completedDate}</span>
        </div>
        <div class="text-xs mb-2 flex gap-0.5">${hearts}</div>
        <p class="text-xs text-muted-foreground italic line-clamp-3 leading-relaxed">"${review.review}"</p>
      </div>
      <button onclick="openFullReviewModal('${review.id}')" class="btn-secondary text-[10px] font-bold py-1.5 px-3 self-end flex items-center gap-1">
        To'liq ko'rish <i data-lucide="chevron-right" class="w-3 h-3"></i>
      </button>
    `;
    reviewsContainer.appendChild(card);
  });
  lucide.createIcons();
}

// --- BOOK PROGRESSION & ROLLOVER LOGIC ---

function logPages(dateStr, pages) {
  if (pages < 0) return;
  
  // 1. Save day log
  const prevPages = state.logs[dateStr] || 0;
  state.logs[dateStr] = pages;
  
  // Calculate the net change in logged pages for today to update book progress
  const netChange = pages - prevPages;
  
  if (netChange !== 0) {
    applyPagesToActiveBook(netChange);
  } else {
    saveToLocalStorage();
    renderApp();
  }
}

function applyPagesToActiveBook(pagesCount) {
  // If we have positive pages count to add
  if (pagesCount > 0) {
    if (!state.currentBookId) {
      // No active book, save state, notify, let them select active book to absorb pages
      rolloverPagesQueue += pagesCount;
      saveToLocalStorage();
      renderApp();
      openNextBookSelectionModal(rolloverPagesQueue);
      return;
    }

    const currentBook = state.books.find(b => b.id === state.currentBookId);
    if (!currentBook || currentBook.status === 'completed') {
      rolloverPagesQueue += pagesCount;
      state.currentBookId = null;
      saveToLocalStorage();
      renderApp();
      openNextBookSelectionModal(rolloverPagesQueue);
      return;
    }

    const pagesLeft = currentBook.totalPages - currentBook.readPages;

    if (pagesCount >= pagesLeft) {
      // Completed active book!
      currentBook.readPages = currentBook.totalPages;
      currentBook.status = 'completed';
      currentBook.completedDate = new Date().toISOString().split('T')[0];
      
      const leftover = pagesCount - pagesLeft;
      rolloverPagesQueue = leftover; // Store remainder in rollover queue
      
      // Trigger Confetti!
      triggerConfettiExplosion();

      saveToLocalStorage();
      renderApp();

      // Open review modal for this completed book
      openReviewModal(currentBook.id);
    } else {
      // Simply add pages
      currentBook.readPages += pagesCount;
      saveToLocalStorage();
      renderApp();
    }
  } 
  // If pages are reduced (negative pagesCount due to user editing and decreasing)
  else if (pagesCount < 0) {
    // Subtract from active book if possible
    let remainingToSubtract = Math.abs(pagesCount);
    
    // Attempt to subtract from currently reading book first
    if (state.currentBookId) {
      const activeBook = state.books.find(b => b.id === state.currentBookId);
      if (activeBook) {
        const sub = Math.min(activeBook.readPages, remainingToSubtract);
        activeBook.readPages -= sub;
        remainingToSubtract -= sub;
      }
    }
    
    // If still have remaining to subtract, do nothing for now (we do not undo completions automatically to prevent complex side effects)
    saveToLocalStorage();
    renderApp();
  }
}

// Trigger review saving and proceed to rollover / next book modal
function saveReviewAndContinue(bookId, rating, reviewText) {
  const book = state.books.find(b => b.id === bookId);
  if (book) {
    book.rating = rating;
    book.review = reviewText;
  }

  // Save to completedReviews cache
  syncReviewsFromBooks();
  saveToLocalStorage();
  renderApp();
  
  // Close review modal
  closeModal("review-modal");

  // Check if we have excess pages to roll over
  if (rolloverPagesQueue > 0) {
    // Open next book selection modal to apply rollover pages
    openNextBookSelectionModal(rolloverPagesQueue);
  } else {
    // If no rollover, but no active book left, ask to select next book with 0 starting rollover
    const hasActive = state.books.some(b => b.status === 'reading');
    const hasPlanned = state.books.some(b => b.status === 'planned');
    if (!hasActive && hasPlanned) {
      openNextBookSelectionModal(0);
    }
  }
}

function selectNextActiveBook(bookId, startingRollover) {
  // 1. Deactivate any previous reading book
  state.books.forEach(b => {
    if (b.status === 'reading') b.status = 'planned';
  });

  // 2. Set new active book
  const book = state.books.find(b => b.id === bookId);
  if (book) {
    book.status = 'reading';
    state.currentBookId = book.id;
  }

  closeModal("next-book-modal");
  
  // Apply rollover pages if any
  if (startingRollover > 0) {
    rolloverPagesQueue = 0; // Clear rollover queue since it's now being applied
    applyPagesToActiveBook(startingRollover);
  } else {
    saveToLocalStorage();
    renderApp();
  }
}

// Confetti Explosion helper using Canvas Confetti
function triggerConfettiExplosion() {
  if (typeof confetti === 'function') {
    const duration = 3 * 1000;
    const end = Date.now() + duration;

    (function frame() {
      confetti({
        particleCount: 5,
        angle: 60,
        spread: 55,
        origin: { x: 0 },
        colors: ['#ff7597', '#9d75ff', '#bef264', '#fde047']
      });
      confetti({
        particleCount: 5,
        angle: 120,
        spread: 55,
        origin: { x: 1 },
        colors: ['#ff7597', '#9d75ff', '#bef264', '#fde047']
      });

      if (Date.now() < end) {
        requestAnimationFrame(frame);
      }
    }());
  }
}

// --- SETUP WIZARD LOGIC ---
let wizardBooks = [];

function addWizardBookUI() {
  const title = document.getElementById("wizard-book-title").value.trim();
  const pages = parseInt(document.getElementById("wizard-book-pages").value);

  if (!title || isNaN(pages) || pages <= 0) {
    alert("Iltimos, kitob nomi va umumiy betlar sonini to'g'ri kiriting!");
    return;
  }

  const id = 'book_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  wizardBooks.push({ id, title, totalPages: pages, readPages: 0, status: 'planned' });

  // Update starting book selection options in wizard
  updateWizardStartingBookSelect();

  // Add to list UI
  const list = document.getElementById("wizard-books-list");
  const li = document.createElement("div");
  li.className = "flex justify-between items-center py-2 px-3 bg-pink-50/50 dark:bg-purple-950/20 border border-pink-100/20 rounded-xl text-xs";
  li.id = `wizard-book-item-${id}`;
  li.innerHTML = `
    <span class="font-bold text-pink-700 dark:text-purple-300 font-serif">${title}</span>
    <div class="flex items-center gap-2">
      <span class="bg-pink-100 dark:bg-purple-900 text-pink-800 dark:text-purple-200 px-2 py-0.5 rounded-full font-bold">${pages} bet</span>
      <button onclick="removeWizardBook('${id}')" class="text-rose-500 hover:text-rose-700"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
    </div>
  `;
  list.appendChild(li);
  lucide.createIcons();

  // Clear inputs
  document.getElementById("wizard-book-title").value = "";
  document.getElementById("wizard-book-pages").value = "";
}

function removeWizardBook(id) {
  wizardBooks = wizardBooks.filter(b => b.id !== id);
  const element = document.getElementById(`wizard-book-item-${id}`);
  if (element) element.remove();
  updateWizardStartingBookSelect();
}

function updateWizardStartingBookSelect() {
  const select = document.getElementById("wizard-starting-book");
  if (!select) return;
  select.innerHTML = '<option value="" disabled selected>Ro\'yxatdan tanlang</option>';
  
  wizardBooks.forEach(b => {
    const opt = document.createElement("option");
    opt.value = b.id;
    opt.innerText = b.title;
    select.appendChild(opt);
  });
}

function completeSetupWizard() {
  const dailyMin = parseInt(document.getElementById("wizard-daily-min").value);
  const startingBookId = document.getElementById("wizard-starting-book").value;
  const customStartDate = document.getElementById("wizard-start-date").value;

  if (isNaN(dailyMin) || dailyMin <= 0) {
    alert("Iltimos, kunlik minimum bet sonini to'g'ri kiriting!");
    return;
  }

  if (wizardBooks.length === 0) {
    alert("Iltimos, kamida bitta kitob kiriting!");
    return;
  }

  if (!startingBookId) {
    alert("Iltimos, birinchi o'qiydigan boshlang'ich kitobingizni tanlang!");
    return;
  }

  // Initialize State
  state.dailyMinPages = dailyMin;
  state.startDate = customStartDate || new Date().toISOString().split('T')[0];
  state.books = [...wizardBooks];
  
  // Set active starting book
  state.books.forEach(b => {
    if (b.id === startingBookId) {
      b.status = 'reading';
    }
  });
  state.currentBookId = startingBookId;
  state.logs = {};
  state.completedReviews = [];

  // Hide wizard, Save to LocalStorage, Render App
  document.getElementById("setup-wizard-overlay").classList.add("hidden");
  saveToLocalStorage();
  renderApp();
}

// --- MODALS INTERACTION LOGIC ---

function openModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove("hidden");
}

function closeModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add("hidden");
}

let activeLogDate = null;

function openLogModal(dateStr) {
  activeLogDate = dateStr;
  const dateFormatted = formatDateDisplay(dateStr);
  document.getElementById("log-modal-title").innerText = `${dateFormatted} - O'qilgan sahifalar`;
  
  const currentVal = state.logs[dateStr] !== undefined ? state.logs[dateStr] : "";
  document.getElementById("log-pages-input").value = currentVal;
  
  openModal("log-modal");
  document.getElementById("log-pages-input").focus();
}

function saveLogModal() {
  const inputVal = document.getElementById("log-pages-input").value;
  if (inputVal.trim() === "") {
    // Remove log if cleared
    const prevPages = state.logs[activeLogDate] || 0;
    delete state.logs[activeLogDate];
    applyPagesToActiveBook(-prevPages);
    closeModal("log-modal");
    return;
  }

  const pages = parseInt(inputVal);
  if (isNaN(pages) || pages < 0) {
    alert("Iltimos, sahifalar sonini musbat sonda kiriting!");
    return;
  }

  logPages(activeLogDate, pages);
  closeModal("log-modal");
}

let activeReviewBookId = null;

function openReviewModal(bookId) {
  activeReviewBookId = bookId;
  const book = state.books.find(b => b.id === bookId);
  if (!book) return;

  document.getElementById("review-book-title").innerText = book.title;
  document.getElementById("review-text").value = "";
  
  // Reset stars
  const radios = document.getElementsByName("review-rating");
  radios.forEach(r => r.checked = false);
  // Default to 5 stars
  document.getElementById("star5").checked = true;

  openModal("review-modal");
}

function saveReviewModal() {
  const text = document.getElementById("review-text").value.trim();
  const ratingRadios = document.getElementsByName("review-rating");
  let rating = 5;
  
  for (let i = 0; i < ratingRadios.length; i++) {
    if (ratingRadios[i].checked) {
      rating = parseInt(ratingRadios[i].value);
      break;
    }
  }

  if (!text) {
    alert("Iltimos, kitob haqida qisqacha xulosa yoki taassurot yozing!");
    return;
  }

  saveReviewAndContinue(activeReviewBookId, rating, text);
}

function openNextBookSelectionModal(rolloverPages) {
  const list = document.getElementById("next-book-list");
  if (!list) return;
  list.innerHTML = "";

  const plannedBooks = state.books.filter(b => b.status === 'planned');

  document.getElementById("next-book-rollover-info").innerHTML = rolloverPages > 0 
    ? `<div class="bg-pink-100/40 dark:bg-purple-950/40 p-3.5 rounded-2xl text-xs border border-pink-100/20 mb-4 text-center">
        Avvalgi kitobdan ortib qolgan <strong class="text-pink-600 dark:text-purple-300 text-sm font-extrabold">${rolloverPages} bet</strong> yangi faollashtirilgan kitobingizga avtomatik qo'shiladi! 🌸
       </div>`
    : "";

  if (plannedBooks.length === 0) {
    list.innerHTML = `
      <div class="text-center p-4 border border-dashed border-pink-200/50 rounded-2xl text-xs text-muted-foreground">
        Hozircha rejalashtirilgan (qizil) kitoblar qolmadi. Iltimos, avval boshqa kitob qo'shing.
      </div>
      <div class="mt-4 flex gap-2">
        <input type="text" id="quick-add-title" placeholder="Kitob nomi" class="glass-input flex-1 px-3 py-2 text-xs">
        <input type="number" id="quick-add-pages" placeholder="Betlar" class="glass-input w-20 px-3 py-2 text-xs">
        <button onclick="quickAddPlannedBook(${rolloverPages})" class="btn-primary text-xs px-3 py-2">Qo'shish</button>
      </div>
    `;
    openModal("next-book-modal");
    return;
  }

  plannedBooks.forEach(book => {
    const div = document.createElement("div");
    div.className = "flex justify-between items-center p-3 mb-2.5 rounded-2xl hover:bg-pink-50/20 dark:hover:bg-purple-950/20 border border-pink-100/20 cursor-pointer glass-panel transition-all";
    div.onclick = () => selectNextActiveBook(book.id, rolloverPages);
    div.innerHTML = `
      <div>
        <h5 class="font-serif font-bold text-sm text-pink-600 dark:text-purple-300">${book.title}</h5>
        <span class="text-xs text-muted-foreground">${book.totalPages} bet</span>
      </div>
      <button class="btn-primary text-[10px] py-1.5 px-3.5 flex items-center gap-1">Tanlash <i data-lucide="check" class="w-3.5 h-3.5"></i></button>
    `;
    list.appendChild(div);
  });
  lucide.createIcons();
  openModal("next-book-modal");
}

function quickAddPlannedBook(rolloverPages) {
  const title = document.getElementById("quick-add-title").value.trim();
  const pages = parseInt(document.getElementById("quick-add-pages").value);

  if (!title || isNaN(pages) || pages <= 0) {
    alert("Iltimos, kitob nomi va betlarini to'g'ri kiriting!");
    return;
  }

  const id = 'book_' + Date.now();
  state.books.push({ id, title, totalPages: pages, readPages: 0, status: 'planned' });
  saveToLocalStorage();
  renderApp();

  // Refresh next book list
  openNextBookSelectionModal(rolloverPages);
}

function openAddBookModal() {
  document.getElementById("add-book-title").value = "";
  document.getElementById("add-book-pages").value = "";
  openModal("add-book-modal");
}

function saveAddBookModal() {
  const title = document.getElementById("add-book-title").value.trim();
  const pages = parseInt(document.getElementById("add-book-pages").value);

  if (!title || isNaN(pages) || pages <= 0) {
    alert("Iltimos, kitob ma'lumotlarini to'g'ri kiriting!");
    return;
  }

  const id = 'book_' + Date.now();
  state.books.push({ id, title, totalPages: pages, readPages: 0, status: 'planned' });
  
  saveToLocalStorage();
  renderApp();
  closeModal("add-book-modal");
}

function openFullReviewModal(bookId) {
  const review = state.completedReviews.find(r => r.id === bookId);
  if (!review) return;

  document.getElementById("full-review-title").innerText = review.title;
  document.getElementById("full-review-date").innerText = `Tugatilgan sana: ${review.completedDate}`;
  
  let hearts = "";
  for (let i = 1; i <= 5; i++) {
    hearts += i <= review.rating ? "💖" : "🤍";
  }
  document.getElementById("full-review-hearts").innerText = hearts;
  document.getElementById("full-review-body").innerText = review.review;

  openModal("full-review-modal");
}

// --- DATA IMPORT & EXPORT UTILITIES ---

function exportDataJSON() {
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(state, null, 2));
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute("href", dataStr);
  downloadAnchor.setAttribute("download", `summer_reading_challenge_105_days_${new Date().toISOString().split('T')[0]}.json`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
}

function triggerImportJSON() {
  document.getElementById("import-file-input").click();
}

function importDataJSON(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const importedState = JSON.parse(e.target.result);
      
      // Basic validation
      if (typeof importedState.dailyMinPages === 'number' && Array.isArray(importedState.books)) {
        state = importedState;
        syncReviewsFromBooks();
        saveToLocalStorage();
        renderApp();
        alert("Ma'lumotlar muvaffaqiyatli import qilindi! 🌸");
      } else {
        alert("Noto'g'ri JSON fayl formati! Iltimos, tizimdan eksport qilingan faylni tanlang.");
      }
    } catch (err) {
      alert("Faylni o'qishda xatolik yuz berdi: " + err.message);
    }
  };
  reader.readAsText(file);
  // Reset file input
  event.target.value = '';
}

// --- LIGHT/DARK THEME TOGGLE ---
function toggleTheme() {
  const body = document.documentElement;
  if (body.classList.contains("dark")) {
    body.classList.remove("dark");
    localStorage.setItem("THEME", "light");
    document.getElementById("theme-toggle-icon").innerHTML = '<i data-lucide="moon" class="w-5 h-5 text-pink-600"></i>';
  } else {
    body.classList.add("dark");
    localStorage.setItem("THEME", "dark");
    document.getElementById("theme-toggle-icon").innerHTML = '<i data-lucide="sun" class="w-5 h-5 text-yellow-300"></i>';
  }
  lucide.createIcons();
}

function initializeTheme() {
  const savedTheme = localStorage.getItem("THEME");
  const body = document.documentElement;
  if (savedTheme === "dark" || (!savedTheme && window.matchMedia("(prefers-color-scheme: dark)").matches)) {
    body.classList.add("dark");
    document.getElementById("theme-toggle-icon").innerHTML = '<i data-lucide="sun" class="w-5 h-5 text-yellow-300"></i>';
  } else {
    body.classList.remove("dark");
    document.getElementById("theme-toggle-icon").innerHTML = '<i data-lucide="moon" class="w-5 h-5 text-pink-600"></i>';
  }
}

// --- INITIALIZATION ---
window.addEventListener("DOMContentLoaded", () => {
  initializeTheme();
  
  // Set default current start date in wizard to today
  document.getElementById("wizard-start-date").value = new Date().toISOString().split('T')[0];

  // Setup click-outside-to-close modals
  const modals = document.querySelectorAll(".modal-overlay");
  modals.forEach(m => {
    m.addEventListener("click", (e) => {
      if (e.target === m) {
        closeModal(m.id);
      }
    });
  });

  lucide.createIcons();

  // Firebase Auth holati — kirish/chiqish kuzatuvchi
  auth.onAuthStateChanged(async (user) => {
    updateAuthUI(user);

    if (user) {
      // Firebase dan yuklashga harakat
      const loadingEl = document.getElementById("firebase-loading");
      if (loadingEl) loadingEl.classList.remove("hidden");

      const firebaseLoaded = await loadFromFirebase();

      if (loadingEl) loadingEl.classList.add("hidden");

      if (firebaseLoaded) {
        document.getElementById("setup-wizard-overlay").classList.add("hidden");
        renderApp();
      } else {
        // Firebase da ma'lumot yo'q — localStorage ni tekshir
        const localLoaded = loadFromLocalStorage();
        if (localLoaded) {
          // Mahalliy ma'lumotni Firebase ga ko'chirish
          saveToFirebase();
          document.getElementById("setup-wizard-overlay").classList.add("hidden");
          renderApp();
        } else {
          document.getElementById("setup-wizard-overlay").classList.remove("hidden");
        }
      }
    } else {
      // Foydalanuvchi kirmagan — faqat localStorage
      const loaded = loadFromLocalStorage();
      if (!loaded) {
        document.getElementById("setup-wizard-overlay").classList.remove("hidden");
      } else {
        renderApp();
      }
    }
  });
});
