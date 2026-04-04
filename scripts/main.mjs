const MODULE_ID = "actor-token-portraits";
const SETTING_USE_DEFAULT_RENDER = "useDefaultRender";
const SETTING_RESPECT_DND5E_PORTRAIT_TOGGLE = "respectDnd5ePortraitToggle";
const SETTING_WILDCARD_TOKEN_MODE = "wildcardTokenMode";

const WILDCARD_TOKEN_MODE_FIRST = "first";
const WILDCARD_TOKEN_MODE_RANDOM = "random";
const WILDCARD_TOKEN_MODE_ACTOR = "actor";

const wildcardTokenImageCache = new Map();

function isModuleEnabled() {
  return !game.settings.get(MODULE_ID, SETTING_USE_DEFAULT_RENDER);
}

function getWildcardTokenMode() {
  return game.settings.get(MODULE_ID, SETTING_WILDCARD_TOKEN_MODE);
}

function isDnd5eSystem() {
  return game.system?.id === "dnd5e";
}

function isDnd5ePortraitToggleEnabled() {
  return isDnd5eSystem() && game.settings.get(MODULE_ID, SETTING_RESPECT_DND5E_PORTRAIT_TOGGLE);
}

function shouldOverrideActorDirectoryImage(actor) {
  if (!isModuleEnabled()) return false;
  if (!isDnd5ePortraitToggleEnabled()) return true;
  return actor?.getFlag?.("dnd5e", "showTokenPortrait") === true;
}

function getRenderedRootElement(html) {
  if (html instanceof HTMLElement) return html;
  if (html?.[0] instanceof HTMLElement) return html[0];
  return null;
}

function getApplicationRootElement(app) {
  if (app?.element instanceof HTMLElement) return app.element;
  if (app?.element?.[0] instanceof HTMLElement) return app.element[0];
  return null;
}

function getActorEntryId(element) {
  return element?.dataset?.documentId ?? element?.dataset?.entryId ?? element?.dataset?.actorId ?? null;
}

function getDefaultArtwork(actor) {
  return actor?.constructor?.getDefaultArtwork?.(actor.toObject()) ?? null;
}

function getActorTokenImage(actor) {
  return actor?.prototypeToken?.texture?.src ?? null;
}

function getActorPortraitFallbackImage(actor) {
  const defaultArtwork = getDefaultArtwork(actor);
  return actor?.img ?? defaultArtwork?.img ?? actor?.constructor?.DEFAULT_ICON ?? null;
}

function getDefaultActorDirectoryFallbackImage(actor) {
  const defaultArtwork = getDefaultArtwork(actor);
  return actor?.img ?? defaultArtwork?.texture?.src ?? defaultArtwork?.img ?? actor?.constructor?.DEFAULT_ICON ?? null;
}

function isWildcardToken(actor) {
  const tokenImage = getActorTokenImage(actor);
  if (!tokenImage) return false;
  return actor?.prototypeToken?.randomImg === true || tokenImage.includes("*");
}

function getWildcardTokenCacheKey(actor) {
  return `${actor?.id ?? "unknown"}::${getActorTokenImage(actor) ?? ""}`;
}

function clearWildcardTokenImageCache(actor = null) {
  if (!actor) {
    wildcardTokenImageCache.clear();
    return;
  }

  const actorId = actor?.id;
  if (!actorId) return;

  for (const cacheKey of Array.from(wildcardTokenImageCache.keys())) {
    if (!cacheKey.startsWith(`${actorId}::`)) continue;
    wildcardTokenImageCache.delete(cacheKey);
  }
}

async function getWildcardTokenImages(actor) {
  if (!actor?.getTokenImages) return [];

  try {
    const images = await actor.getTokenImages();
    if (!Array.isArray(images)) return [];
    return images.filter(Boolean);
  } catch (error) {
    console.warn(`${MODULE_ID} | Failed to resolve wildcard token images for actor ${actor?.id ?? "unknown"}`, error);
    return [];
  }
}

function getCachedRandomWildcardTokenImage(actor, images) {
  const cacheKey = getWildcardTokenCacheKey(actor);
  const cachedImage = wildcardTokenImageCache.get(cacheKey);
  if (cachedImage && images.includes(cachedImage)) return cachedImage;

  const randomImage = images[Math.floor(Math.random() * images.length)];
  wildcardTokenImageCache.set(cacheKey, randomImage);
  return randomImage;
}

async function getActorDirectoryImage(actor) {
  const tokenImage = getActorTokenImage(actor);
  if (!tokenImage) return getDefaultActorDirectoryFallbackImage(actor);

  if (!isWildcardToken(actor)) return tokenImage;

  const wildcardTokenMode = getWildcardTokenMode();
  if (wildcardTokenMode === WILDCARD_TOKEN_MODE_ACTOR) {
    return getActorPortraitFallbackImage(actor);
  }

  const tokenImages = await getWildcardTokenImages(actor);
  if (!tokenImages.length) return getActorPortraitFallbackImage(actor);

  if (wildcardTokenMode === WILDCARD_TOKEN_MODE_RANDOM) {
    return getCachedRandomWildcardTokenImage(actor, tokenImages);
  }

  return tokenImages[0];
}

function hasFlattenedKey(flattenedChanged, key) {
  return Object.hasOwn(flattenedChanged, key);
}

function hasFlattenedKeyPrefix(flattenedChanged, prefix) {
  return Object.keys(flattenedChanged).some((key) => key === prefix || key.startsWith(`${prefix}.`));
}

function hasRelevantActorDirectoryChange(changed) {
  const flattenedChanged = foundry.utils.flattenObject(changed ?? {});

  if (hasFlattenedKey(flattenedChanged, "img")) return true;
  if (hasFlattenedKeyPrefix(flattenedChanged, "prototypeToken")) return true;

  if (!isDnd5ePortraitToggleEnabled()) return false;

  return hasFlattenedKey(flattenedChanged, "flags.dnd5e.showTokenPortrait")
    || hasFlattenedKey(flattenedChanged, "flags.dnd5e.-=showTokenPortrait");
}

function rerenderOpenActorDirectories() {
  const directories = [ui.actors, ui.actors?.popout].filter(Boolean);
  for (const directory of directories) {
    directory.render(true);
  }
}

async function updateActorEntryPortrait(actor, app) {
  if (!shouldOverrideActorDirectoryImage(actor)) return;

  const root = getApplicationRootElement(app);
  if (!root) return;

  const selector = [
    `[data-document-id="${actor.id}"]`,
    `[data-entry-id="${actor.id}"]`,
    `[data-actor-id="${actor.id}"]`
  ].join(", ");

  const entryElements = root.querySelectorAll(selector);
  if (!entryElements.length) return;

  const image = await getActorDirectoryImage(actor);
  if (!image) return;

  for (const element of entryElements) {
    const portrait = element.querySelector("img");
    if (!portrait || portrait.getAttribute("src") === image) continue;
    portrait.setAttribute("src", image);
  }
}

async function refreshOpenActorDirectories(actor) {
  const directories = [ui.actors, ui.actors?.popout].filter(Boolean);
  await Promise.all(directories.map((directory) => updateActorEntryPortrait(actor, directory)));
}

async function applyTokenPortraits(app, html) {
  if (!isModuleEnabled()) return;

  const root = getRenderedRootElement(html);
  if (!root) return;

  const entryElements = root.querySelectorAll("[data-document-id], [data-entry-id], [data-actor-id]");
  await Promise.all(Array.from(entryElements, async (element) => {
    const actorId = getActorEntryId(element);
    if (!actorId) return;

    const actor = game.actors?.get(actorId);
    if (!actor) return;
    if (!shouldOverrideActorDirectoryImage(actor)) return;

    const image = await getActorDirectoryImage(actor);
    if (!image) return;

    const portrait = element.querySelector("img");
    if (!portrait || portrait.getAttribute("src") === image) return;

    portrait.setAttribute("src", image);
  }));
}

function updateDnd5ePortraitToggleSettingState(app, html) {
  const root = getRenderedRootElement(html);
  if (!root) return;

  const selector = `input[name="${MODULE_ID}.${SETTING_RESPECT_DND5E_PORTRAIT_TOGGLE}"]`;
  const input = root.querySelector(selector);
  if (!(input instanceof HTMLInputElement)) return;

  const isEditable = isDnd5eSystem();
  const title = game.i18n.localize(`${MODULE_ID}.Settings.RespectDnd5ePortraitToggle.Hint`);

  input.disabled = !isEditable;
  input.setAttribute("aria-disabled", String(!isEditable));

  const formGroup = input.closest(".form-group");
  if (!isEditable) {
    input.setAttribute("title", title);
    formGroup?.setAttribute("title", title);
    return;
  }

  input.removeAttribute("title");
  formGroup?.removeAttribute("title");
}

Hooks.once("init", () => {
  game.settings.register(MODULE_ID, SETTING_USE_DEFAULT_RENDER, {
    name: `${MODULE_ID}.Settings.UseDefaultRender.Name`,
    hint: `${MODULE_ID}.Settings.UseDefaultRender.Hint`,
    scope: "client",
    config: true,
    type: Boolean,
    default: false,
    onChange: () => {
      rerenderOpenActorDirectories();
    }
  });

  game.settings.register(MODULE_ID, SETTING_WILDCARD_TOKEN_MODE, {
    name: `${MODULE_ID}.Settings.WildcardTokenMode.Name`,
    hint: `${MODULE_ID}.Settings.WildcardTokenMode.Hint`,
    scope: "client",
    config: true,
    type: String,
    choices: {
      [WILDCARD_TOKEN_MODE_FIRST]: `${MODULE_ID}.Settings.WildcardTokenMode.Choices.First`,
      [WILDCARD_TOKEN_MODE_RANDOM]: `${MODULE_ID}.Settings.WildcardTokenMode.Choices.Random`,
      [WILDCARD_TOKEN_MODE_ACTOR]: `${MODULE_ID}.Settings.WildcardTokenMode.Choices.Actor`
    },
    default: WILDCARD_TOKEN_MODE_FIRST,
    onChange: () => {
      clearWildcardTokenImageCache();
      rerenderOpenActorDirectories();
    }
  });

  game.settings.register(MODULE_ID, SETTING_RESPECT_DND5E_PORTRAIT_TOGGLE, {
    name: `${MODULE_ID}.Settings.RespectDnd5ePortraitToggle.Name`,
    hint: `${MODULE_ID}.Settings.RespectDnd5ePortraitToggle.Hint`,
    scope: "client",
    config: true,
    type: Boolean,
    default: false,
    onChange: () => {
      rerenderOpenActorDirectories();
    }
  });

  console.info(`${MODULE_ID} | Initializing`);
});

Hooks.on("renderActorDirectory", applyTokenPortraits);
Hooks.on("renderSettingsConfig", updateDnd5ePortraitToggleSettingState);
Hooks.on("updateActor", (actor, changed) => {
  if (!isModuleEnabled()) return;

  if (!hasRelevantActorDirectoryChange(changed)) return;

  clearWildcardTokenImageCache(actor);

  if (isDnd5ePortraitToggleEnabled()) {
    rerenderOpenActorDirectories();
    return;
  }

  void refreshOpenActorDirectories(actor);
});