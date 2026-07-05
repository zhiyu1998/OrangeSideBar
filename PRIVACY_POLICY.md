## Privacy Policy

**Effective date:** July 5, 2026

OrangeSideBar ("the Extension", "we", "us", or "our") provides an AI-powered browser side panel for webpage summarization, translation, question answering, Markdown export, and related reading-assistance features.

This Privacy Policy explains what information the Extension handles, how that information is used, when it may be transmitted to third parties chosen by the user, and the choices available to users.

### 1. Information We Handle

The Extension may handle the following categories of data in order to provide its features:

- **Authentication information**: user-provided API keys, API base URLs, and provider configuration for supported AI services.
- **Personal communications**: prompts, chat messages, and other text the user enters into the Extension.
- **Web history-related data**: the URL and title of the active tab, and, when the user explicitly chooses, the URLs and titles of other selected tabs in the current window.
- **Website content**: webpage text, page HTML, PDF text, video subtitle text, and similar content from pages the user asks the Extension to analyze or export.
- **Locally stored preferences and session data**: selected model, prompt settings, theme, provider settings, and locally stored chat/session history.

### 2. How We Use Information

We use the information described above only to provide the Extension's single purpose: helping users understand and work with the content of the page they are viewing through AI-assisted summarization, translation, question answering, subtitle processing, and Markdown export.

Examples include:

- extracting webpage, PDF, or subtitle content the user requests;
- sending user prompts and extracted content to the AI provider configured by the user;
- saving settings and chat/session state locally so the Extension continues to work across the side panel, popup, and settings page;
- copying user-requested output to the clipboard;
- showing notifications for user-initiated actions;
- checking the latest public release version of the Extension from GitHub.

### 3. Where Data Is Stored

The Extension stores settings and local session data in `chrome.storage.local` on the user's device. This may include:

- provider configuration;
- API keys;
- selected model and prompt preferences;
- theme and UI preferences;
- local chat and session history.

We do not operate a dedicated backend server for storing this extension data as part of the Extension's normal functionality.

### 4. When Data Is Sent to Third Parties

When the user chooses to use AI features, the Extension may transmit relevant data to the AI provider configured by the user. This may include:

- the user's prompt or chat message;
- extracted webpage text;
- PDF text;
- video subtitle text;
- related metadata needed to fulfill the user's request.

These requests are sent directly from the Extension to the provider endpoint configured by the user, or through extension background/network mechanisms required for compatibility with that provider.

The privacy practices of any AI provider selected by the user are governed by that provider's own terms and privacy policy. Users are responsible for reviewing and choosing the providers they use.

The Extension may also make limited requests to:

- websites and documents the user asks it to process;
- public video subtitle resources required for subtitle extraction;
- the public GitHub Releases API to check whether a newer version of the Extension is available.

### 5. Data Sharing and Sale

We do **not** sell user data.

We do **not** use or transfer user data for advertising, profiling, or any purpose unrelated to the Extension's single purpose.

We do **not** use or transfer user data to determine creditworthiness or for lending purposes.

We only transfer data to third parties when necessary to provide a feature the user explicitly requests, such as sending prompts and content to the user's selected AI provider.

### 6. Remote Code

The Extension does not load or execute remote code. All executable extension code is packaged with the Extension. Network access is used only to retrieve content or communicate with user-selected external services.

### 7. Permissions

The Extension requests browser permissions only as needed for its functionality, including:

- `sidePanel` to provide the main user interface;
- `storage` to save settings and local session data;
- `activeTab` and `tabs` to access the current tab and, when the user chooses, other selected tabs;
- `scripting` to run packaged scripts needed to extract content from pages;
- `clipboardWrite` to copy user-requested content;
- `contextMenus` to provide page actions such as summarizing a page or copying page content as Markdown;
- `notifications` to provide status feedback for user-initiated actions;
- `offscreen` to support reliable Markdown conversion and clipboard workflows;
- `declarativeNetRequest` only for compatibility with certain user-configured third-party AI endpoints.

### 8. Data Retention

Data stored locally by the Extension remains on the user's device until the user clears it, changes it, or removes the Extension.

Data transmitted to third-party AI providers or external websites is subject to those third parties' own retention and privacy practices.

### 9. Security

We aim to minimize data access to what is necessary for the requested feature. Data sent over the network is transmitted using the protocols provided by the target service, typically HTTPS where supported by the provider or website.

However, no method of transmission or storage can be guaranteed to be completely secure, and users should avoid sending sensitive information to third-party AI providers unless they understand and accept that provider's policies.

### 10. Children's Privacy

The Extension is not directed to children under 13, and we do not knowingly design the Extension to collect personal information from children.

### 11. Changes to This Privacy Policy

We may update this Privacy Policy from time to time to reflect product, legal, or operational changes. The updated version will be posted with a new effective date.

### 12. Contact

If you have questions about this Privacy Policy, please contact:

- **Developer/Project name:** OrangeSideBar
- **Contact email:** `rrorangedev@gmail.com`
- **Project page (optional):** `https://github.com/zhiyu1998/OrangeSideBar`
