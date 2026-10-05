# Godt Haill menu design

The supplied transparent RGBA logos are copied byte-for-byte to
`src/assets/brand/godt-haill-logo.png` (full logo, 1672 × 941 px) and
`src/assets/brand/godt-haill-header.png` (simplified logo, 2172 × 724 px).
`GameLogo.tsx` selects the full image by default or the simplified image with
`variant="header"`, with accessible alt text and explicit aspect ratio. There
is no separate title text in the header. No artwork is generated or edited.

The login hero reads “Norges sykeste fiskespill”. The opening menu uses the
full logo without the previous welcome/description paragraphs or continue
subtitle. Its two single-line buttons are at most 300 px wide and 44 px high,
retaining usable touch targets on phones.

`src/style.css` imports Tailwind, the existing game layout in `game-base.css`,
then `menu-theme.css`. The latter owns shared UI tokens: marine blue surfaces,
warm sand/gold primary actions, light blue accents, readable pale text and
clear keyboard focus. Game tiles, sprites and their pixel filtering stay in
the original game renderer. UI typography and the supplied logo use ordinary
browser rendering.

The theme covers login/register/password-reset, the authenticated opening
menu and reset confirmation, pause menu, inventory/storage, fish book, shop,
wardrobe, fishing panels, messages, account pages and mobile controls. The
pause/start menus share the logo and a small set of line icons in `MenuIcon.tsx`.
Buttons, callbacks, persistence, item handling and game input logic retain
their existing behaviour. The browser title and footer use Godt Haill.

Preview: `/tools/menu-preview.html`, with optional `?view=start|pause|bag|book|shop|wardrobe`
and `?saved=0`. It uses actual menu components with offline fixtures and never
resets an account. The existing `/tools/game-preview.html` exercises the real
game and input paths with its local services; `/` shows the actual auth forms.

`tools/check-menu-browser.mjs` covers desktop, 390 px / DPR-3 mobile, 320 px
phones and landscape: both logo variants/aspect ratios, revised copy and compact
buttons, local register validation,
reset form, saved/unsaved opening states, reset cancellation and restored
focus, real pause/inventory/fish-book navigation and bait selection, clipping
and horizontal overflow. Screenshots go to `output/menu-review/`.

Typecheck/build are run in the existing isolated review copy with the published
`fisherSprite.ts`. The unrelated local portrait edits are preserved and excluded
from this change. No authentication requests creating accounts or sending
password-reset mail are part of the tests.
