

async function initEditPage() {
    const data = await fetchJson("/data/merged_and_tiered.json");
    const countries = await loadCountries();
    const characters = await fetchJson("/assets/characters.json");
    const overrides = await fetchJson("/data/player_overrides.json").catch(() => ({}));
    document.getElementById("event-list").append(...(data.events ?? []).map(event => buildEventRow(event, countries)));}

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

function buildEventRow(event, countries) {
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
    return row;
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

initEditPage();