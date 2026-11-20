const DATA_URL = "../data/merged_and_tiered.json";

// load merged_and_tiered.json: { window: {start, end}, generated_at, events: [...] }
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

function setFlag(img, country) {
    if (!img) return;
    if (country) {
        img.src = `https://flagcdn.com/${country.toLowerCase()}.svg`;
        img.alt = country;
    } else {
        img.remove();
    }
}

// fill a copy of the page's #player-template for one player
function buildPlayer(player) {
    const row = document.getElementById("player-template").content.cloneNode(true);
    const item = row.firstElementChild;

    row.querySelector(".tag").textContent = player.tag;
    setFlag(row.querySelector(".player-flag"), player.country);

    const rank = row.querySelector(".rank");
    if (player.rank) {
        item.dataset.rank = player.rank;
        if (rank) rank.textContent = `#${player.rank}`;
    } else if (rank) {
        rank.remove();
    }

    const mains = row.querySelector(".mains");
    for (const main of player.mains ?? []) {
        const icon = document.createElement("img");
        icon.src = main.icon_url;
        icon.alt = icon.title = main.name;
        mains?.append(icon);
    }
    return row;
}

// fill a copy of the page's #event-template for one event;
// each page has its own templates, so the same code draws both layouts
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

// one combined graphic for the weekend (single_card.html)
function renderBoard(data) {
    const board = document.getElementById("board");
    for (const event of data.events) {
        board.append(buildEvent(event));
    }
}

// one card per event (card_per_event.html)
function renderCards(data) {
    const cards = document.getElementById("cards");
    for (const event of data.events) {
        cards.append(buildEvent(event));
    }
}

// each page has its own container, which decides the layout
loadData()
    .then(data => {
        if (document.getElementById("board")) renderBoard(data);
        if (document.getElementById("cards")) renderCards(data);
    })
    .catch(error => {
        console.error(error);
        document.body.prepend(Object.assign(document.createElement("p"), { textContent: error.message }));
    });
