Create `studio.html` and `studio.js` as a standalone management dashboard.

### 1. Data Logic
- **Source**: Firestore collection `timeline/${level}/components`.
- **Display**: All items in this collection must be rendered in the preview area, regardless of their `published` status.
- **Published Field**: Each item has a `published` boolean. This is ONLY for controlling whether the data is accessible by the separate Review system. It does not affect the Timeline display.
- **Auto-Save**: Implement `oninput` with a 1000ms debounce to update Firestore fields.

### 2. Studio Layout
- **Left (40%)**: Expanded editing forms for all cards (Character, Pinyin, Markdown Content, Image URL).
- **Right (60%)**: Live preview cards using `lesson-template-b.css`.
- **Markdown**: Use a shared `markdown-renderer.js` (extract logic from `lesson-template-b.js`).

### 3. Features
- **Teaching Modal**: Click a card to show a 60% width focused modal.
- **Sidebar Toggle**: A button to hide the left editing panel.
- **SortableJS**: Sync dragging between the form list and the preview list to update the `order` field.

### 4. Constraints
- Strictly follow the CSS/JS styles of `lesson-template-b`. 
- DO NOT mention or use any background information not present in the code files.