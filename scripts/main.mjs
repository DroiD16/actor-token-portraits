const MODULE_ID = "actor-token-portraits";
const SETTING_USE_DEFAULT_RENDER = "useDefaultRender";
const SETTING_RESPECT_DND5E_PORTRAIT_TOGGLE = "respectDnd5ePortraitToggle";

function isModuleEnabled() {
  return !game.settings.get(MODULE_ID, SETTING_USE_DEFAULT_RENDER);
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

function getActorDirectoryImage(actor) {
  const tokenImage = actor?.prototypeToken?.texture?.src;
  if (tokenImage) return tokenImage;

  if (actor?.img) return actor.img;

  const defaultArtwork = actor?.constructor?.getDefaultArtwork?.(actor.toObject());
  return defaultArtwork?.texture?.src ?? defaultArtwork?.img ?? null;
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

function updateActorEntryPortrait(actor, app) {
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

  const image = getActorDirectoryImage(actor);
  if (!image) return;

  for (const element of entryElements) {
    const portrait = element.querySelector("img");
    if (!portrait || portrait.getAttribute("src") === image) continue;
    portrait.setAttribute("src", image);
  }
}

function refreshOpenActorDirectories(actor) {
  const directories = [ui.actors, ui.actors?.popout].filter(Boolean);
  for (const directory of directories) {
    updateActorEntryPortrait(actor, directory);
  }
}

function applyTokenPortraits(app, html) {
  if (!isModuleEnabled()) return;

  const root = getRenderedRootElement(html);
  if (!root) return;

  const entryElements = root.querySelectorAll("[data-document-id], [data-entry-id], [data-actor-id]");
  for (const element of entryElements) {
    const actorId = getActorEntryId(element);
    if (!actorId) continue;

    const actor = game.actors?.get(actorId);
    if (!actor) continue;
    if (!shouldOverrideActorDirectoryImage(actor)) continue;

    const image = getActorDirectoryImage(actor);
    if (!image) continue;

    const portrait = element.querySelector("img");
    if (!portrait || portrait.getAttribute("src") === image) continue;

    portrait.setAttribute("src", image);
  }
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

  if (isDnd5ePortraitToggleEnabled()) {
    rerenderOpenActorDirectories();
    return;
  }

  refreshOpenActorDirectories(actor);
});