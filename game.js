// ======== UI handles ========
const $ = (id) => document.getElementById(id);
// screens
const startScreen = $("start-screen");
const startBtn = $("start-btn");

const table = $("table");
const dealerCardsEl = $("dealer-cards");
const playerCardsEl = $("player-cards");
const dealerTotalEl = $("dealer-total");
const playerTotalEl = $("player-total");
const statusEl = $("status");

const dealBtn = $("deal");
const hitBtn = $("hit");
const standBtn = $("stand");
const restartBtn = $("restart");

const bankrollEl = $("bankroll");
const betInput = $("bet");
const betMinBtn = $("bet-min");
const betMaxBtn = $("bet-max");

const resetBankrollBtn = $("reset-bankroll");

const bustOverlay = $("bust-overlay");
const tryAgainBtn = $("try-again");
bustOverlay.hidden = true; // make sure it starts hidden

// ======== Game constants ========
const START_BANKROLL = 1000;
const MIN_BET = 10;
const MAX_BET = 100;

const SUITS = ["♠","♥","♦","♣"];
const VALUES = ["A","2","3","4","5","6","7","8","9","10","J","Q","K"];

// ======== State ========
const state = {
  bankroll: 0,
  betLocked: 0,
  player: [],
  dealer: [],
  dealerHiddenRevealed: false,
  roundOver: false,
  started: false
};

// ======== Helpers ========
function randomCard() {
  const v = VALUES[Math.floor(Math.random() * VALUES.length)];
  const s = SUITS[Math.floor(Math.random() * SUITS.length)];
  return { v, s };
}
function cardValue(v) {
  if (v === "A") return 11;
  if (["K","Q","J"].includes(v)) return 10;
  return parseInt(v, 10);
}
function handTotal(cards) {
  let total = 0, aces = 0;
  for (const c of cards) {
    total += cardValue(c.v);
    if (c.v === "A") aces++;
  }
  while (total > 21 && aces > 0) {
    total -= 10;
    aces--;
  }
  return total;
}
function renderCard(c, faceDown=false) {
  const div = document.createElement("div");
  div.className = "card" + (faceDown ? " face-down" : "") + ((c.s === "♥" || c.s === "♦") ? " red" : "");
  div.textContent = faceDown ? " " : `${c.v}${c.s}`;
  return div;
}
function clampBet(n) {
  n = Math.floor(Number(n) || 0);
  if (n < MIN_BET) n = MIN_BET;
  if (n > MAX_BET) n = MAX_BET;
  if (n > state.bankroll) n = Math.max(MIN_BET, Math.min(state.bankroll, MAX_BET));
  return n;
}
function updateHUD() {
  bankrollEl.textContent = state.bankroll;
  dealerTotalEl.textContent = state.dealerHiddenRevealed ? handTotal(state.dealer) : (state.dealer.length ? cardValue(state.dealer[0].v) : 0);
  playerTotalEl.textContent = handTotal(state.player);
}
function renderHands() {
  dealerCardsEl.innerHTML = "";
  state.dealer.forEach((c, i) => dealerCardsEl.appendChild(renderCard(c, i === 1 && !state.dealerHiddenRevealed)));
  playerCardsEl.innerHTML = "";
  state.player.forEach(c => playerCardsEl.appendChild(renderCard(c)));
  updateHUD();
}
function setControls({canDeal, canPlay, canRestart}) {
  dealBtn.disabled = !canDeal;
  hitBtn.disabled = !canPlay;
  standBtn.disabled = !canPlay;
  restartBtn.disabled = !canRestart;
}

// ======== Start / Bankroll ========
function showTable() {
  startScreen.classList.add("hidden");
  table.classList.remove("hidden");
}
function initBankroll() {
  state.bankroll = START_BANKROLL;
  betInput.value = MIN_BET;
  updateHUD();
  statusEl.textContent = "Place your bet and press Deal. (Dealer wins all ties.)";
  setControls({canDeal:true, canPlay:false, canRestart:false});
  bustOverlay.hidden = true;
}

// ======== Round Flow ========
function lockBet() {
  const bet = clampBet(betInput.value);
  betInput.value = bet;
  if (bet > state.bankroll) return false;
  state.betLocked = bet;
  return true;
}
function deal() {
  if (!lockBet()) {
    statusEl.textContent = "Your bet exceeds your bankroll. Lower it.";
    return;
  }
  // Deduct bet upfront
  state.bankroll -= state.betLocked;

  state.player = [randomCard(), randomCard()];
  state.dealer = [randomCard(), randomCard()];
  state.dealerHiddenRevealed = false;
  state.roundOver = false;

  statusEl.textContent = `Bet locked: $${state.betLocked}. Hit or Stand.`;
  setControls({canDeal:false, canPlay:true, canRestart:false});
  renderHands();

  // auto-resolve if player busts immediately (unlikely)
  if (handTotal(state.player) > 21) stand();
}
function hit() {
  if (state.roundOver) return;
  state.player.push(randomCard());
  renderHands();
  if (handTotal(state.player) > 21) {
    // player busts — dealer wins
    state.dealerHiddenRevealed = true;
    endRound("You busted. Dealer wins.");
  }
}
function stand() {
  if (state.roundOver) return;
  state.dealerHiddenRevealed = true;
  resolveDealerAlwaysWins();
  renderHands();
  endRound(); // message set by resolver
}
function endRound(msg) {
  state.roundOver = true;
  if (!msg) msg = statusEl.textContent;
  statusEl.textContent = msg;

  // No payout because dealer always wins.
  setControls({canDeal:true, canPlay:false, canRestart:true});
  updateHUD();

  // Broke?
  if (state.bankroll <= 0) {
    setControls({ca
