const DATA_URL = "../data/merged_and_tiered.json";

const TIER_ORDER = ["P", "S+", "S", "A+", "A", "B+", "B", "C"];
const TIER_COLOUR = { P: "--tier-P", "S+": "--tier-Sp", S: "--tier-S", "A+": "--tier-Ap", A: "--tier-A",
    "B+": "--tier-Bp", B: "--tier-B", C: "--tier-C" };
const MAJOR_TIERS = new Set(["P", "S+", "S", "A+", "A"]);

const PLAYER_LIMIT = { major: 80, other: 30 };
const BOARD_COLUMNS = 3;
const TRAVELLER_WIDTH = 290;

// pre local filter
const PRELOCAL = /\bpre\b|\b(pre-?)?locals?\b/i;

let downloadName = "ultrank-upcoming.png";
async function loadData() {
    if (location.protocol === "file:") {
        throw new Error("Open this page through a server (python -m http.server), not by double-clicking it.");
    }
    const response = await fetch(DATA_URL, { cache: "no-store" });
    if (!response.ok) {
        throw new Error(`Couldn't load ${DATA_URL}: ${response.status} ${response.statusText}`);
    }
    return response.json();
}

function isPrelocal(event) {
    return PRELOCAL.test(event.tournament ?? "") || PRELOCAL.test(event.event ?? "");
}

function byRank(a, b) {
    return (a.rank ?? Infinity) - (b.rank ?? Infinity)
        || (a.tag ?? "").localeCompare(b.tag ?? "", undefined, { sensitivity: "base" });
}

const regionNames = new Intl.DisplayNames(["en"], { type: "region" });

function countryName(code) {
    if (!code) return "Other";
    try {
        return regionNames.of(code.toUpperCase()) ?? code;
    } catch {
        return code;
    }
}

function div(className, ...children) {
    const el = document.createElement("div");
    el.className = className;
    el.append(...children);
    return el;
}

function setFlag(img, country) {
    if (!img) return;
    if (country) {
        img.src = `https://flagcdn.com/${country.toLowerCase()}.svg`;
        img.alt = country;
    } else {
        img.remove();
    }
}
function buildPlayer(player) {
    const row = document.getElementById("player-template").content.cloneNode(true);

    row.querySelector(".tag").textContent = player.tag;
    setFlag(row.querySelector(".player-flag"), player.country);

    const rank = row.querySelector(".rank");
    if (player.rank) rank.textContent = `#${player.rank}`;
    else rank.remove();

    const mains = row.querySelector(".mains");
    for (const main of player.mains ?? []) {
        const icon = document.createElement("img");
        icon.src = main.icon_url;
        icon.alt = icon.title = main.name;
        mains.append(icon);
    }
    return row;
}

function playerList(players, withFlags) {
    const list = div("chips");
    for (const player of players) {
        const row = buildPlayer(player);
        if (!withFlags) row.querySelector(".player-flag")?.remove();
        list.append(row);
    }
    return list;
}

function countryHeading(code) {
    const flag = document.createElement("img");
    flag.className = "flag";
    const heading = div("country-head", flag, countryName(code));
    setFlag(flag, code);
    return heading;
}
function packIntoColumns(container, items, count) {
    const columns = Array.from({ length: count }, () => div("col"));
    container.replaceChildren(...columns);
    container.style.gridTemplateColumns = `repeat(${count}, minmax(0, 1fr))`;
    for (const item of items) {
        const shortest = columns.reduce((a, b) => (b.offsetHeight < a.offsetHeight ? b : a));
        shortest.append(item);
    }
}

function fillEventHeader(card, event) {
    card.style.setProperty("--tier", `var(${TIER_COLOUR[event.tier]})`);
    card.querySelector(".tier-pill").textContent = event.tier;
    card.querySelector(".name").textContent = event.tournament ?? event.event ?? "";
    card.querySelector(".meta").textContent = [event.city, event.entrants && `${event.entrants} entrants`]
        .filter(Boolean)
        .join(" · ");
    setFlag(card.querySelector(".flag"), event.country);

    const logo = card.querySelector(".logo");
    if (event.logo_url) logo.src = event.logo_url;
    else logo.remove();
}
function addMajorPlayers(body, players, homeCountry) {
    const home = players.filter(p => p.country === homeCountry);
    if (home.length) body.append(countryHeading(homeCountry), playerList(home, false));

    const away = {};
    for (const p of players) {
        if (p.country !== homeCountry) (away[p.country ?? ""] ??= []).push(p);
    }
    const countries = Object.keys(away).sort((a, b) => countryName(a).localeCompare(countryName(b)));
    if (!countries.length) return;

    const travellers = div("travellers");
    for (const code of countries) {
        travellers.append(div("", countryHeading(code || null), playerList(away[code], false)));
    }
    body.append(travellers);
}

function buildBoardEvent(event) {
    const card = document.getElementById("event-template").content.firstElementChild.cloneNode(true);
    const major = MAJOR_TIERS.has(event.tier);
    fillEventHeader(card, event);

    const all = [...(event.players ?? [])].sort(byRank);
    const shown = all.slice(0, major ? PLAYER_LIMIT.major : PLAYER_LIMIT.other);
    const body = card.querySelector(".players");

    if (major) addMajorPlayers(body, shown, event.country);
    else body.append(playerList(shown, true));

    const hidden = all.length - shown.length;
    if (hidden > 0) body.append(div("more", `+${hidden} more`));
    return card;
}
function packTravellers(card) {
    const travellers = card.querySelector(".travellers");
    if (!travellers) return;
    const count = Math.max(1, Math.floor(travellers.clientWidth / TRAVELLER_WIDTH));
    packIntoColumns(travellers, [...travellers.children], count);
}

function renderBoard(data) {
    const board = document.getElementById("board");
    const events = (data.events ?? [])
        .filter(event => TIER_ORDER.includes(event.tier) && !isPrelocal(event))
        .sort((a, b) => TIER_ORDER.indexOf(a.tier) - TIER_ORDER.indexOf(b.tier));
    for (const event of events.filter(e => MAJOR_TIERS.has(e.tier))) {
        const card = buildBoardEvent(event);
        board.append(card);
        packTravellers(card);
    }
    const others = events.filter(e => !MAJOR_TIERS.has(e.tier));
    if (others.length) {
        const grid = div("packed");
        board.append(grid);
        packIntoColumns(grid, others.map(buildBoardEvent), BOARD_COLUMNS);
    }
}

function renderDates(range) {
    const el = document.querySelector(".dates");
    if (!el || !range) return;
    const start = new Date(`${range.start}T00:00`);
    const end = new Date(`${range.end}T00:00`);
    const format = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" });
    el.textContent = format.formatRange(start, end);
}

function buildEvent(event) {
    const block = document.getElementById("event-template").content.cloneNode(true);

    block.querySelector(".name").textContent = event.tournament;
    block.querySelector(".tier").textContent = event.tier ?? "";
    setFlag(block.querySelector(".flag"), event.country);

    const players = block.querySelector(".players");
    for (const player of event.players ?? []) {
        players.append(buildPlayer(player));
    }
    return block;
}

function renderCards(data) {
    const cards = document.getElementById("cards");
    for (const event of data.events) {
        cards.append(buildEvent(event));
    }
}

async function downloadPng() {
    const button = document.getElementById("download");
    const label = button.textContent;
    button.disabled = true;
    button.textContent = "Rendering…";
    try {
        const url = await htmlToImage.toPng(document.querySelector(".canvas"), {
            pixelRatio: 2,
            style: { margin: "0" },
            backgroundColor: getComputedStyle(document.body).backgroundColor,
        });
        const link = document.createElement("a");
        link.href = url;
        link.download = downloadName;
        link.click();
    } catch (error) {
        console.error(error);
        alert(`Couldn't make the PNG: ${error.message ?? error}`);
    } finally {
        button.disabled = false;
        button.textContent = label;
    }
}

async function main() {
    try {
        const data = await loadData();
        renderDates(data.window);
        if (data.window?.start) downloadName = `ultrank-upcoming-${data.window.start}.png`;
        await document.fonts.ready;

        if (document.getElementById("board")) renderBoard(data);
        if (document.getElementById("cards")) renderCards(data);
    } catch (error) {
        console.error(error);
        document.body.prepend(Object.assign(document.createElement("p"), { textContent: error.message }));
    }
}

document.getElementById("download")?.addEventListener("click", downloadPng);
main();
