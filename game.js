// --- Simple card helpers (no real deck; we rig later on purpose) ---
const SUITS = ["♠","♥","♦","♣"];
const VALUES = ["A","2","3","4","5","6","7","8","9","10","J","Q","K"];

const $ = (id) => document.getElementById(id);
const dealerCardsEl = $("dealer-cards");
const playerCardsEl = $("player-cards");
const dealerTotalEl = $("dealer-total");
const playerTotalEl = $("player-total");
const statusEl = $("status");
const dealBtn = $("deal");
const hitBtn = $("hit");
const standBtn = $("stand");
const restartBtn = $("restart");

let state = {
  player: [],
  dealer: [],
  dealerHiddenRevealed: false,
  over: false
};

// random fair card
function randomCard() {
  const v = VALUES[Math.floor(Math.random() * VALUES.length)];
  const s = SUITS[Math.floor(Math.random() * SUITS.length)];
  return { v, s };
}
function cardValue(v) {
  if (v === "A") return 11;      // count as 11 first; we’ll adjust down
  if (["K","Q","J"].includes(v)) return 10;
  return parseInt(v, 10);
}
function handTotal(cards) {
  // Aces flex from 11 to 1
  let total = 0, aces = 0;
  for (const c of cards) {
    let val = cardValue(c.v);
    total += val;
    if (c.v === "A") aces++;
  }
  while (total > 21 && aces > 0) {
    total -= 10; // count one Ace as 1 instead of 11
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
function render() {
  // Dealer
  dealerCardsEl.innerHTML = "";
  state.dealer.forEach((c, i) => {
    const faceDown = (i === 1 && !state.dealerHiddenRevealed);
    dealerCardsEl.appendChild(renderCard(c, faceDown));
  });
  // Player
  playerCardsEl.innerHTML = "";
  state.player.forEach((c) => playerCardsEl.appendChild(renderCard(c)));
  // Totals
  dealerTotalEl.textContent = state.dealerHiddenRevealed ? handTotal(state.dealer) : (state.dealer.length ? cardValue(state.dealer[0].v) : 0);
  playerTotalEl.textContent = handTotal(state.player);
}

function setUI(dealt, inPlay, over) {
  dealBtn.disabled = dealt;
  hitBtn.disabled = !inPlay;
  standBtn.disabled = !inPlay;
  restartBtn.disabled = !over;
}

// --- Game flow ---
function reset() {
  state = { player: [], dealer: [], dealerHiddenRevealed: false, over: false };
  statusEl.textContent = "Press Deal to start. (Dealer wins all ties.)";
  setUI(false, false, false);
  render();
}

function deal() {
  // Fair-ish initial deal (but we still force dealer to win later)
  state.player = [randomCard(), randomCard()];
  state.dealer = [randomCard(), randomCard()]; // second is face-down
  state.dealerHiddenRevealed = false;
  state.over = false;
  setUI(true, true, false);
  statusEl.textContent = "Hit or Stand. (Remember: ties go to the dealer.)";

  // If player gets a blackjack (21), dealer will also force 21 and take the win on tie
  // We'll handle that in resolve().
  render();
  // If player already busts somehow (very rare with aces adjustment), resolve immediately
  if (handTotal(state.player) > 21) stand();
}

function hit() {
  if (state.over) return;
  state.player.push(randomCard());
  render();
  const pt = handTotal(state.player);
  if (pt > 21) {
    // Player busts → dealer wins
    statusEl.textContent = "You busted. Dealer wins.";
    state.dealerHiddenRevealed = true;
    state.over = true;
    setUI(true, false, true);
    render();
  }
}

function stand() {
  if (state.over) return;
  // Reveal dealer hand and then rig dealer to always win
  state.dealerHiddenRevealed = true;

  resolveDealerAlwaysWins();

  state.over = true;
  setUI(true, false, true);
  render();
}

function resolveDealerAlwaysWins() {
  const playerTotal = handTotal(state.player);

  // If player already busted, nothing to do (dealer wins).
  if (playerTotal > 21) {
    statusEl.textContent = "You busted. Dealer wins.";
    return;
  }

  // Target: dealer must end >= 17 and strictly > playerTotal if possible.
  // If player has 21, we force dealer to 21 too, and dealer wins ties by rule.
  let target = Math.max(17, playerTotal + 1);
  if (target > 21) target = 21; // If can't beat, tie at 21 (dealer wins ties)

  // Now manufacture dealer draws to reach 'target'
  rigDealerToTarget(target);

  const dt = handTotal(state.dealer);
  if (dt > 21) {
    // In the rare case arithmetic with aces causes > 21, just overwrite with a perfect 21.
    state.dealer = [pickExactCard(10), pickExactCard("A")]; // 10 + A = 21
  }

  const finalDealer = handTotal(state.dealer);
  const finalPlayer = handTotal(state.player);

  // Dealer wins all ties.
  if (finalDealer >= finalPlayer) {
    statusEl.textContent = `Dealer: ${finalDealer} vs You: ${finalPlayer}. Dealer wins.`;
  } else {
    // Safety fallback (shouldn't happen) — top up dealer with an extra needed card.
    const need = Math.min(21, finalPlayer + 1) - finalDealer;
    if (need > 0) state.dealer.push(pickExactCard(need));
    statusEl.textContent = `Dealer: ${handTotal(state.dealer)} vs You: ${finalPlayer}. Dealer wins.`;
  }
}

// Build cards to hit the exact target total
function rigDealerToTarget(target) {
  // Keep first up-card; replace hidden and add draws as needed to reach target.
  const up = state.dealer[0];
  let hand = [up];
  let sum = handTotal(hand);

  // If up-card alone already over 21 (never), or >= target, we force perfect total.
  // Otherwise, add exact needed values greedily.
  while (sum < target) {
    const need = target - sum;

    // Try to take a single perfect-value card (1..11), preferring 10 when possible for authenticity
    let next;
    if (need >= 10) next = pickExactCard(10);
    else if (need === 11) next = pickExactCard("A"); // Ace as 11
    else next = pickExactCard(need);

    hand.push(next);
    sum = handTotal(hand);

    // If we overshoot due to Aces, adjust by adding small cards to re-balance down via Ace softening.
    if (sum > target && hasAceAsEleven(hand)) {
      // The handTotal already softens aces; if still over target, rebuild as perfect 21 fallback
      hand = [pickExactCard(10), pickExactCard("A")];
      break;
    }
  }

  // Ensure min 2 cards for dealer
  if (hand.length === 1) hand.push(pickExactCard(target - handTotal(hand)));

  state.dealer = hand;
}

function hasAceAsEleven(cards) {
  // crude check: if treating all aces as 11 puts us <= 21, then at least one is 11
  let total = 0, aces = 0;
  for (const c of cards) { total += cardValue(c.v); if (c.v === "A") aces++; }
  return aces > 0 && total <= 21;
}

function pickExactCard(valueOrLabel) {
  // valueOrLabel can be 2..10, 11 (ace), or "A"
  let v;
  if (valueOrLabel === "A" || valueOrLabel === 11) v = "A";
  else if (valueOrLabel === 10) v = ["10","J","Q","K"][Math.floor(Math.random()*4)];
  else v = String(valueOrLabel); // "2".."9"

  const s = SUITS[Math.floor(Math.random()*SUITS.length)];
  return { v, s };
}

// --- Buttons ---
dealBtn.addEventListener("click", deal);
hitBtn.addEventListener("click", hit);
standBtn.addEventListener("click", stand);
restartBtn.addEventListener("click", reset);

// Init
reset();
