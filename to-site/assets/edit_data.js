

async function initEditPage() {
    const data = await fetchJson("/data/merged_and_tiered.json");
    const countries = await loadCountries();
    const characters = await fetchJson("/assets/characters.json");
    const overrides = await fetchJson("/data/player_overrides.json").catch(() => ({}));
    document.getElementById("event-list").append(...(data.events ?? []).map(event => buildEventRow(event, countries, characters)));
    // add event button
    document.getElementById("add-event").addEventListener("click", () => {
        const row = buildEventRow(newEvent(), countries, characters);
        row.querySelector(".show-toggle").checked = true;
        row.querySelector("details").open = true;
        document.getElementById("event-list").append(row);
    });
}

async function fetchJson(url) {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) throw new Error(`Couldn't load ${url}: ${response.status} ${response.statusText}`);
    return response.json();
}

async function loadCountries() {
    const codes = await fetchJson("https://flagcdn.com/en/codes.json")
    return Object.entries(codes)
        .filter(([code]) => !code.startsWith("us-"))
        .map(([code, name]) => ({ code, name}))
        .sort((a, b) => a.name.localeCompare(b.name));
}

function buildEventRow(event, countries, characters) {
    const row = fromTemplate("event-row-template");
    row.dataset.slug = event.slug;
    row.style.setProperty("--tier", `var(${TIER_COLOUR[event.tier] ?? "--muted"})`);
    row.querySelector(".show-toggle").checked = (TIER_ORDER.includes(event.tier) && event.tier !== "D" && !isPrelocal(event))
    row.querySelector(".tier-pill").textContent = event.tier ?? "-";
    row.querySelector(".name").textContent = [event.tournament, event.event].filter(Boolean).join(" - ");
    const fields = row.querySelector(".event-fields");
    fields.querySelector('[name="tournament"]').value = event.tournament ?? "";
    fields.querySelector('[name="event"]').value = event.event ?? "";
    fields.querySelector('[name="city"]').value = event.city ?? "";
    fields.querySelector('[name="entrants"]').value = event.entrants ?? "";
    fillCountrySelect(countries, fields.querySelector(".country-select"), event.country);
    fillTierSelect(fields, event.tier);
    const limit = MAJOR_TIERS.has(event.tier) ? PLAYER_LIMIT.major : PLAYER_LIMIT.other;
    const players = [...(event.players ?? [])].sort(byRank);
    row.querySelector(".player-list").append(
        ...players.map((p, i) => buildPlayerRow(p, i < limit, countries, characters))
    );
    // add player button
    row.querySelector(".add-player").addEventListener("click", () => {
        const newRow = buildPlayerRow(newPlayer(), true, countries, characters);
        newRow.querySelector("details").open = true;
        row.querySelector(".player-list").append(newRow);
    });
    return row;
}

function buildPlayerRow(player, shown, countries, characters) {
    const row = fromTemplate("player-row-template");
    row.dataset.id = player.startgg_id;
    row.querySelector(".show-toggle").checked = shown;
    row.querySelector(".rank").textContent = player.rank != null ? `#${player.rank}` : "-";
    row.querySelector(".tag").textContent = player.tag;
    const fields = row.querySelector(".player-fields");
    fields.querySelector('[name="tag"]').value = player.tag ?? "";
    fields.querySelector('[name="rank"]').value = player.rank ?? "";
    fillCountrySelect(countries, fields.querySelector(".country-select"), player.country);
    fields.querySelectorAll('[name="main"]').forEach((select, i) => {
        select.replaceChildren(new Option("-", ""), ...characters.map(c => new Option(c.name, c.name)));
        select.value = player.mains?.[i]?.name ?? "";
    });
    const updateSummary = () => updatePlayerSummary(row, characters);
    fields.addEventListener("change", updateSummary);
    updateSummary();
    return row;
}

function updatePlayerSummary(row, characters) {
    const country = row.querySelector('.player-fields [name="country"]').value;
    const flag = row.querySelector(".player-summary .player-flag");
    flag.hidden = !country;
    if (country) {
        flag.src = `https://flagcdn.com/${country.toLowerCase()}.svg`;
        flag.alt = country;
    }

    const mainNames = [...row.querySelectorAll('.player-fields [name="main"]')]
        .map(select => select.value)
        .filter(Boolean);
    row.querySelector(".player-summary .mains").replaceChildren(...mainNames.map(name => {
        const icon = document.createElement("img");
        icon.src = characters.find(c => c.name === name)?.icon_url ?? "";
        icon.alt = icon.title = name;
        return icon;
    }));
}

function fillCountrySelect(countries, container, code) {
    const select = container.querySelector('[name="country"]');
    const flag = container.querySelector(".flag");

    select.replaceChildren(
        new Option("-", ""),
        ...countries.map(c => new Option(c.name, c.code.toUpperCase()))
    );
    select.value = code ?? "";

    const updateFlag = () => {
        flag.hidden = !select.value;
        if (select.value) {
            flag.src = `https://flagcdn.com/${select.value.toLowerCase()}.svg`;
            flag.alt = select.value;
        }
    };
    select.addEventListener("change", updateFlag);
    updateFlag();
}

function fillTierSelect(container, tier) {
    const select = container.querySelector('[name="tier"]');
    select.replaceChildren(
        new Option("-", ""),
        ...TIER_ORDER.map(t => new Option(t, t))
    );
    select.value = tier ?? "";
}

function newPlayer() {
    return { startgg_id: `custom-${crypto.randomUUID()}`, tag: "New player" };
}

function newEvent() {
    return { slug: `custom-${crypto.randomUUID()}`, tournament: "New event" };
}


initEditPage();