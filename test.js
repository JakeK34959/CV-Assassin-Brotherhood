/**
 * @name PasscodeLock
 * @author arg0NNY
 * @authorLink https://github.com/arg0NNY/DiscordPlugins
 * @invite M8DBtcZjXD
 * @donate https://donationalerts.com/r/arg0nny
 * @version 1.4.6
 * @description Protect your Discord with a passcode.
 * @website https://github.com/arg0NNY/DiscordPlugins/tree/master/PasscodeLock
 * @source https://github.com/arg0NNY/DiscordPlugins/blob/master/PasscodeLock/PasscodeLock.plugin.js
 * @updateUrl https://raw.githubusercontent.com/arg0NNY/DiscordPlugins/master/PasscodeLock/PasscodeLock.plugin.js
 */

module.exports = (() => {
    const config = {
        "info": {
            "name": "PasscodeLock",
            "authors": [
                {
                    "name": "arg0NNY",
                    "discord_id": '224538553944637440',
                    "github_username": 'arg0NNY'
                }
            ],
            "version": "1.4.6",
            "description": "Protect your Discord with a passcode.",
            github: "https://github.com/arg0NNY/DiscordPlugins/tree/master/PasscodeLock",
            github_raw: "https://raw.githubusercontent.com/arg0NNY/DiscordPlugins/master/PasscodeLock/PasscodeLock.plugin.js"
        },
        "changelog": [
            {
                "type": "fixed",
                "title": "Fixed",
                "items": [
                    "Fixed lock screen sometimes failed to be properly displayed on Discord startup."
                ]
            }
        ]
    };

    const electron = require("electron");
    const request = require("request");
    const fs = require("fs");
    const path = require("path");

    return !global.ZeresPluginLibrary ? class {
        constructor() {
            this._config = config;
        }

        getName() { return config.info.name; }
        getAuthor() { return config.info.authors.map(a => a.name).join(", "); }
        getDescription() { return config.info.description; }
        getVersion() { return config.info.version; }

        load() {
            BdApi.UI.showConfirmationModal("Library Missing", `The library plugin needed for ${config.info.name} is missing. Please click Download Now to install it.`, {
                confirmText: "Download Now",
                cancelText: "Cancel",
                onConfirm: () => {
                    request.get("https://rauenzi.github.io/BDPluginLibrary/release/0PluginLibrary.plugin.js", async (error, response, body) => {
                        if (error) return electron.shell.openExternal("https://betterdiscord.app/Download?id=9");
                        await new Promise(r => fs.writeFile(path.join(BdApi.Plugins.folder, "0PluginLibrary.plugin.js"), body, r));
                    });
                }
            });
        }
        start() { }
        stop() { }
    } : (([Plugin, Api]) => {
        const plugin = (Plugin, Api) => {
            const {
                DOM
            } = BdApi;

            const {
                Patcher,
                DiscordModules,
                WebpackModules,
                Settings,
                DOMTools,
                Toasts,
                Utilities
            } = Api;

            const {
                React,
                ReactDOM,
                ModalActions,
                ConfirmationModal,
                ButtonData,
                VoiceInfo,
                WindowInfo,
                Dispatcher
            } = DiscordModules;

            const Data = new Proxy({}, {
                get (_, k) {
                    return BdApi.Data.load(config.info.name, k);
                },
                set (_, k, v) {
                    BdApi.Data.save(config.info.name, k, v);
                    return true;
                }
            });

            const Selectors = {
                Chat: WebpackModules.getByProps("title", "chat"),
                App: WebpackModules.getByProps('mobileApp'),
                Modals: WebpackModules.getByProps('root', 'small')
            };

            const Gifs = {
                LOCKED_INTRO: 'https://i.imgur.com/gu9ybte.png',
                LOCKED_SHAKE: 'https://i.imgur.com/gu9ybte.png',
                SETTINGS_INTRO: 'https://i.imgur.com/4N8QZ2o.gif',
                SETTINGS_ROTATE: 'https://i.imgur.com/v74rA2L.gif',
                EDIT_INTRO: 'https://i.imgur.com/NrhmZym.gif',
                EDIT_ACTION: 'https://i.imgur.com/VL5UV1X.gif'
            };
            Object.keys(Gifs).forEach(k => fetch(Gifs[k])); // Preload gifs

            const buildAnimatedIcon = (src, width = 64, height = 74) => {
                const icon = document.createElement('img');
                icon.alt = 'PCLIcon';
                icon.width = width;
                icon.height = height;
                icon.src = src;
                icon.style.opacity = '0';

                setTimeout(() => {
                    icon.style.opacity = '1';
                    icon.src = src;
                }, 0);

                return icon;
            };

            const b64binb = base64String => Uint8Array.from(atob(base64String), c => c.charCodeAt(0));
            const str2binb = str => new TextEncoder().encode(str);
            const buf2hex = buffer => Array.prototype.map.call(new Uint8Array(buffer), x => ('00' + x.toString(16)).slice(-2)).join('');
            async function pbkdf2_generate_key_from_string(string) {
                return crypto.subtle.importKey(
                    "raw",
                    str2binb(string),
                    {
                        name: "PBKDF2",
                    },
                    false,
                    ["deriveKey", "deriveBits"],
                );
            }
            async function pbkdf2_derive_salted_key(key, salt, iterations) {
                return crypto.subtle.deriveKey(
                    {
                        name: "PBKDF2",
                        salt: salt,
                        iterations: iterations,
                        hash: {name: "SHA-1"}
                    },
                    key,
                    {
                        name: "HMAC",
                        hash: "SHA-1",
                        length: 160
                    },
                    true,
                    ["sign", "verify"]
                );
            }
            async function pbkdf2(string, salt, iterations) {
                const key = await pbkdf2_generate_key_from_string(string);
                return buf2hex(await window.crypto.subtle.exportKey(
                    "raw",
                    await pbkdf2_derive_salted_key(key, b64binb(salt), iterations)
                ));
            }

            const hashCode = async string => {
                const salt = buf2hex(self.crypto.getRandomValues(new Uint8Array(32)));
                const iterations = 4000;
                const hash = await pbkdf2(string, salt, iterations);

                return { hash, salt, iterations };
            };

            const hashCheck = async ({ string, salt, iterations }, hashed) => await pbkdf2(string, salt, iterations) === hashed;

            const Button = ButtonData;
            const Tooltip = BdApi.Components.Tooltip;
            const Keybinds = WebpackModules.getByProps('combokeys', 'disable');
            const Markdown = WebpackModules.getByProps('rules');
            const Common = WebpackModules.getByProps('Shakeable', 'List');
            const { Anchor } = Common;
            const LanguageStore = WebpackModules.getModule(m => m.Messages?.IMAGE);
            const VoiceActions = WebpackModules.getByProps('toggleSelfDeaf', 'toggleSelfMute');
            const SoundActions = WebpackModules.getByProps('playSound', 'createSound');
            const { getVoiceChannelId } = WebpackModules.getByProps('getVoiceChannelId');
            const KeybindStore = WebpackModules.getByProps('toCombo', 'toString');
            const { getMainWindowId } = WebpackModules.getByProps('getMainWindowId');

            // Help translate the plugin on the Crowdin page: https://crwd.in/betterdiscord-passcodelock
            const Locale = new class {

                constructor() {
                    this._names = ['ENTER_PASSCODE', 'ENTER_NEW_PASSCODE', 'RE_ENTER_PASSCODE', 'EDIT_PASSCODE', 'LOCK_DISCORD', 'CODE_TYPE_SETTING', '4DIGIT_NCODE', '6DIGIT_NCODE', 'CUSTOM_NCODE', 'AUTOLOCK_SETTING', 'AUTOLOCK_DESC', 'AUTOLOCK_DISABLED', 'AUTOLOCK_1M', 'AUTOLOCK_5M', 'AUTOLOCK_1H', 'AUTOLOCK_5H', 'LOCK_KEYBIND_SETTING', 'ALWAYS_LOCK_SETTING', 'ALWAYS_LOCK_DESC', 'HIGHLIGHT_TYPING_SETTING', 'HIGHLIGHT_TYPING_DESC', 'NOTIFICATIONS_SETTING', 'NOTIFICATIONS_SETTING_DISABLE', 'NOTIFICATIONS_SETTING_CENSOR', 'NEW_NOTIFICATION', 'NEW_NOTIFICATION_DESC', 'FIRST_SETUP_MESSAGE', 'PASSCODE_UPDATED_MESSAGE', 'PASSCODE_RESET_DEFAULT_MESSAGE', 'PASSCODE_RESET_SECURITY_UPDATE_MESSAGE', 'ATTENTION_MESSAGE'];
                    this.raw = {
                        'en': ["Enter your Discord passcode", "Enter your new passcode", "Re-enter your passcode", "Edit Passcode", "Lock Discord", "Code type", "4-Digit Numeric Code", "6-Digit Numeric Code", "Custom Numeric Code", "Auto-lock", "Require passcode if away for a time.", "Disabled", "in 1 minute", "in 5 minutes", "in 1 hour", "in 5 hours", "Lock keybind", "Always lock on startup", "Locks Discord at startup, even if it wasn't locked before Discord shut down", "Highlight keyboard typing", "Highlights buttons on screen when typing passcode from the keyboard", "Notifications when locked", "Disable notifications", "Censor notifications", "New notification", "You have 1 new notification!", "Please first set up the passcode in the plugin settings.", "Passcode has been updated!", "Your passcode has been reset. Set it up again.", "Your passcode has been reset due to security update. Set it up again in the settings.", "### ATTENTION PLEASE!\n\nThis plugin **DOES** prevent people who are casually snooping, **BUT** if anyone has access to the computer with Discord logged in and is actually determined to get access to it, there's nothing PasscodeLock can do within the scope of a BD plugin to prevent them.\n\nThe real solution from a security perspective is just... lock or log out of your computer when you're not at it. *(c) Qwerasd*"],
                    }

                    this.lang = this.generateDict(this._names, this.raw);
                }

                generateDict(names, raw) {
                    const dict = {};

                    for (const key in raw) {
                        dict[key] = {};
                        raw[key].forEach((value, i) => {
                            dict[key][names[i]] = value;
                        });
                    }

                    return dict;
                }

                getCurrentLocale() {
                    return (LanguageStore.getLocale() || LanguageStore.chosenLocale || LanguageStore._chosenLocale || "en").replace("en-US", "en").replace("en-GB", "en");
                }

                get current() {
                    return this.lang[this.getCurrentLocale()] ?? this.lang["en"];
                }

            }();

            const BG_TRANSITION = 350;
            const MAX_CODE_LENGTH = 15;
            var CODE_LENGTH = 4;

            const getContainer = () => document.body;

            class PasscodeBtn extends React.Component {
                render() {
                    return React.createElement(
                        'div',
                        {
                            className: 'PCL--btn PCL--animate',
                            onClick: this.props.click ? () => this.props.click(this.props.number) : () => {},
                            id: `PCLBtn-${this.props.code ?? this.props.number}`
                        },
                        (!this.props.children ? [
                            React.createElement(
                                'div',
                                { className: 'PCL--btn-number' },
                                this.props.number
                            ),
                            React.createElement(
                                'div',
                                { className: 'PCL--btn-dec' },
                                this.props.dec
                            )
                        ] : this.props.children)
                    );
                }
            }

            class PasscodeLocker extends React.Component {
                static Types = {
                    DEFAULT: 'default',
                    SETTINGS: 'settings',
                    EDITOR: 'editor'
                }

                get e() { return document.getElementById(this.props.plugin.getName()); }
                get bg() { return this.e.querySelector('.PCL--layout-bg'); }
                get button() { return this.props.button ?? document.getElementById('PCLButton'); }
                get buttonPos() { return this.button && document.body.contains(this.button) ? this.button.getBoundingClientRect() : { top: 0, left: 0, width: window.innerWidth, height: window.innerHeight }; }
                get containerPos() { return getContainer().getBoundingClientRect() }

                backspaceButton() {
                    return React.createElement(PasscodeBtn, {
                        click: this.codeBackspace,
                        code: 'Backspace',
                        children: React.createElement(
                            'svg',
                            {
                                xmlns: 'http://www.w3.org/2000/svg',
                                viewBox: '0 0 24 24',
                                height: '22',
                                width: '22'
                            },
                            React.createElement('path', { fill: 'currentColor', d: 'M22 3H7c-.69 0-1.23.35-1.59.88L.37 11.45c-.22.34-.22.77 0 1.11l5.04 7.56c.36.52.9.88 1.59.88h15c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-3.7 13.3c-.39.39-1.02.39-1.41 0L14 13.41l-2.89 2.89c-.39.39-1.02.39-1.41 0-.39-.39-.39-1.02 0-1.41L12.59 12 9.7 9.11c-.39-.39-.39-1.02 0-1.41.39-.39 1.02-.39 1.41 0L14 10.59l2.89-2.89c.39-.39 1.02-.39 1.41 0 .39.39.39 1.02 0 1.41L15.41 12l2.89 2.89c.38.38.38 1.02 0 1.41z' })
                        )
                    })
                }

                get_background() {
                    const cssFilePath = '/Users/jake/Library/Application Support/BetterDiscord/themes/AssassinBrotherhood.theme.css';
                    var style_path = getComputedStyle(document.body)
                    var background_img_pre = style_path.getPropertyValue('--background-image')
                    var background_img = background_img_pre.slice(6, -2);
                    return background_img
                }

                buildCancelButton() {
                    if([PasscodeLocker.Types.SETTINGS, PasscodeLocker.Types.EDITOR].includes(this.props.type)) {
                        return React.createElement(PasscodeBtn, {
                            click: () => this.unlock(false),
                            code: 'Escape',
                            children: React.createElement(
                                'svg',
                                {
                                    xmlns: 'http://www.w3.org/2000/svg',
                                    viewBox: '0 0 24 24',
                                    height: '30',
                                    width: '30'
                                },
                                React.createElement('path', { fill: 'currentColor', d: 'M19 11H7.83l4.88-4.88c.39-.39.39-1.03 0-1.42-.39-.39-1.02-.39-1.41 0l-6.59 6.59c-.39.39-.39 1.02 0 1.41l6.59 6.59c.39.39 1.02.39 1.41 0 .39-.39.39-1.02 0-1.41L7.83 13H19c.55 0 1-.45 1-1s-.45-1-1-1z' })
                            )
                        });
                    } else if (CODE_LENGTH === -1) {
                        return this.backspaceButton();
                    } else {
                        return React.createElement('div')
                    }
                }

                buildBackspaceButton() {
                    if([PasscodeLocker.Types.SETTINGS, PasscodeLocker.Types.EDITOR].includes(this.props.type) || CODE_LENGTH !== -1) {
                        return this.backspaceButton();
                    } else {
                        return this.buildEnterButton();
                    }
                }

                buildEnterButton() {
                    return React.createElement(PasscodeBtn, {
                        click: () => this.codeAccept(),
                        code: 'Enter',
                        children: React.createElement(
                            'svg',
                            {
                                xmlns: 'http://www.w3.org/2000/svg',
                                viewBox: '0 0 48 48',
                                height: '34',
                                width: '34'
                            },
                            React.createElement('path', { fill: 'none', d: 'M0 0h24v24H0V0z' }),
                            React.createElement('path', { fill: 'currentColor', d: 'M21.05 28.55 16.15 23.65Q15.7 23.2 15.05 23.2Q14.4 23.2 13.9 23.7Q13.4 24.2 13.4 24.85Q13.4 25.5 13.9 25.95L20 32.05Q20.45 32.5 21.05 32.5Q21.65 32.5 22.1 32.05L34.1 20.05Q34.55 19.6 34.525 18.95Q34.5 18.3 34.05 17.85Q33.6 17.35 32.925 17.35Q32.25 17.35 31.75 17.85ZM24 44Q19.75 44 16.1 42.475Q12.45 40.95 9.75 38.25Q7.05 35.55 5.525 31.9Q4 28.25 4 24Q4 19.8 5.525 16.15Q7.05 12.5 9.75 9.8Q12.45 7.1 16.1 5.55Q19.75 4 24 4Q28.2 4 31.85 5.55Q35.5 7.1 38.2 9.8Q40.9 12.5 42.45 16.15Q44 19.8 44 24Q44 28.25 42.45 31.9Q40.9 35.55 38.2 38.25Q35.5 40.95 31.85 42.475Q28.2 44 24 44ZM24 24Q24 24 24 24Q24 24 24 24Q24 24 24 24Q24 24 24 24Q24 24 24 24Q24 24 24 24Q24 24 24 24Q24 24 24 24ZM24 41Q31.25 41 36.125 36.125Q41 31.25 41 24Q41 16.75 36.125 11.875Q31.25 7 24 7Q16.75 7 11.875 11.875Q7 16.75 7 24Q7 31.25 11.875 36.125Q16.75 41 24 41Z' })
                        )
                    })
                }

                calculatePosition() {
                    const buttonPos = this.buttonPos;
                    return {
                        top: buttonPos.top + buttonPos.height/2 - this.containerPos.top,
                        left: buttonPos.left + buttonPos.width/2 - this.containerPos.left
                    };
                }

                calculateRadius(pos) {
                    pos = pos ?? this.calculatePosition();

                    return Math.hypot(Math.max(pos.top, this.containerPos.height - pos.top), Math.max(pos.left, this.containerPos.width - pos.left));
                }

                constructor(props) {
                    super(props);

                    this.state = {
                        code: '',
                        confirm: false,
                        delay: false,
                        delayLeft: 0
                    };
                    this.handleDelay();

                    this.codeAppend = (num) => {
                        if(this.state.code.length >= MAX_CODE_LENGTH) {
                            const dots = document.querySelector(".PCL--dots");
                            if(!dots.classList.contains("PCL--dots--limit")) {
                                dots.classList.add("PCL--dots--limit");
                                setTimeout(() => {
                                    dots?.classList.remove("PCL--dots--limit");
                                }, 250);
                            }
                            return;
                        }
                        this.setState({
                            code: this.state.code + num.toString()
                        });

                        setTimeout(() => {
                            if(CODE_LENGTH !== -1 && CODE_LENGTH <= this.state.code.length)
                                this.codeAccept();
                        });
                    }

                    this.codeAccept = () => {
                        if (this.state.code === '') return;

                        if (this.props.type === PasscodeLocker.Types.EDITOR) {
                            if (!this.state.confirm) {
                                this.newCode = this.state.code;
                                this.setState({
                                    code: '',
                                    confirm: true
                                });
                                if (this.icon) this.icon.src = Gifs.EDIT_ACTION;
                            }
                            else {
                                if (this.state.code !== this.newCode) this.fail();
                                else this.unlock(true);
                            }
                        }
                        else this.codeSubmit();
                    }

                    this.codeBackspace = () => {
                        this.setState({
                            code: this.state.code.slice(0, -1)
                        });
                    }
                }

                async codeSubmit() {
                    if (await hashCheck({
                        string: this.state.code,
                        salt: this.props.plugin.settings.salt,
                        iterations: this.props.plugin.settings.iterations
                    }, this.props.plugin.settings.hash))
                        this.unlock();
                    else
                        this.fail();
                }

                fail() {
                    this.setState({
                        code: '',
                    });

                    if (this.icon) this.icon.src = {
                        [PasscodeLocker.Types.DEFAULT]: Gifs.LOCKED_SHAKE,
                        [PasscodeLocker.Types.SETTINGS]: Gifs.SETTINGS_ROTATE,
                        [PasscodeLocker.Types.EDITOR]: Gifs.EDIT_ACTION
                    }[this.props.type];

                    if (this.props.type !== PasscodeLocker.Types.DEFAULT) return;

                    Data.attempts = (Data.attempts ?? 0) + 1;
                    if (Data.attempts >= 3) {
                        Data.delayUntil = Date.now() + Math.min(30000, 5000 * (Data.attempts - 2));
                        this.handleDelay();
                    }
                }

                unlock(success = true) {
                    this.e.querySelector('.PCL--controls').style.opacity = 0;
                    this.bgCircle(false);

                    setTimeout(() => this.bg.style.transition = null, 50);
                    setTimeout(() => {
                        this.bg.style.transform = null;

                        const listener = () => {
                            this.bg.removeEventListener('webkitTransitionEnd', listener);

                            setTimeout(() => {
                                this.props.plugin.unlock(true);
                                if (success && this.props.onSuccess) return this.props.onSuccess(this);
                                if (success && this.props.type === PasscodeLocker.Types.EDITOR) return this.props.plugin.updateCode(this.newCode);
                            }, 50);
                        };
                        this.bg.addEventListener('webkitTransitionEnd', listener);
                    }, 100);
                }

                bgCircle(smooth = true) {
                    const bg = this.bg;
                    const pos = this.calculatePosition();
                    const d = this.calculateRadius(pos) * 2;

                    if (smooth) bg.style.transition = null;
                    bg.style.top = pos.top + 'px';
                    bg.style.left = pos.left + 'px';
                    bg.style.width = d + 'px';
                    bg.style.height = d + 'px';
                    bg.style.transform = 'translate(-50%, -50%) scale(1)';
                    bg.style.borderRadius = '50%';
                }

                bgFill() {
                    const bg = this.bg;
                    bg.style.transition = 'none';
                    bg.style.top = 0;
                    bg.style.left = 0;
                    bg.style.width = '100%';
                    bg.style.height = '100%';
                    bg.style.borderRadius = 0;
                    bg.style.transform = 'scale(1)';
                }

                componentWillUnmount() {
                    clearInterval(this.delayHandler);
                    window.removeEventListener('keyup', this.keyUpListener);
                    window.removeEventListener('keydown', this.disableKeys, true);
                    if (this.props.type === PasscodeLocker.Types.DEFAULT) this.enableNotifications();
                }

                handleDelay(delayUntil = Data.delayUntil) {
                    if (Date.now() >= Data.delayUntil && !this.state.delay) return;

                    this.setState(Object.assign(
                        {},
                        {
                            delay: Date.now() < Data.delayUntil,
                            delayLeft: Math.ceil((delayUntil - Date.now()) / 1000)
                        },
                        Date.now() < Data.delayUntil ? {code: ''} : {}
                    ));
                }

                componentDidMount() {
                    document.onkeydown = e => {
                        e.preventDefault();
                        e.stopPropagation();

                        if (this.state.delay) return false;
                        if (this.props.plugin.settings.highlightButtons) document.getElementById(`PCLBtn-${e.key}`)?.classList.add('PCL--btn-active');

                        return false;
                    };

                    this.keyUpListener = e => {
                        if (this.props.plugin.settings.highlightButtons) document.getElementById(`PCLBtn-${e.key}`)?.classList.remove('PCL--btn-active');
                        if (this.state.delay) return;

                        if (!isNaN(+e.key) && e.key !== ' ') this.codeAppend(+e.key);
                        if (e.key === 'Backspace') this.codeBackspace();
                        if (e.key === 'Escape' && this.props.type !== PasscodeLocker.Types.DEFAULT) this.unlock(false);
                    };
                    window.addEventListener('keyup', this.keyUpListener);

                    // Manage delay
                    this.delayHandler = setInterval(() => this.handleDelay(), 1000);

                    // Manage notifications
                    if (this.props.type === PasscodeLocker.Types.DEFAULT) this.enableNotifications = this.props.plugin.settings.hideNotifications
                        ? Patcher.instead(DiscordModules.NotificationModule, 'showNotification', () => false)
                        : Patcher.before(DiscordModules.NotificationModule, 'showNotification', (self, params) => {
                            params[0] = Gifs.LOCKED_SHAKE;
                            params[1] = Locale.current.NEW_NOTIFICATION;
                            params[2] = Locale.current.NEW_NOTIFICATION_DESC;
                            if (params[4].onClick) params[4].onClick = () => {};
                        });

                    // Props to https://github.com/253ping
                    this.disableKeys = e => {
                        // Didn't know that there is more than one shortcut.
                        if(e.ctrlKey && e.shiftKey && (e.key === "I" || e.key === "C" )) {e.preventDefault(); e.stopPropagation();}
                        else if(e.ctrlKey) {e.preventDefault(); e.stopPropagation(); return false;} // Prevent all sorts of shortcuts like bold, italic, underline, strikethrough, ...
                        else if (e.key === "Enter") {
                            if (CODE_LENGTH !== -1) return;

                            e.preventDefault();
                            e.stopPropagation();
                            if (this.state.delay) return false;

                            if (this.props.plugin.settings.highlightButtons) document.getElementById('PCLBtn-Enter')?.classList.add('PCL--btn-active');
                            this.codeAccept();
                            return false;
                        }
                    }
                    window.addEventListener('keydown', this.disableKeys, true);

                    setTimeout(() => {
                        this.bgCircle();

                        const i = setInterval(() => {
                            const bgPos = this.bg.getBoundingClientRect();
                            const top = bgPos.top + bgPos.height/2;
                            const left = bgPos.left + bgPos.width/2;
                            const radius = bgPos.width/2;

                            Array.from(document.querySelectorAll('.PCL--animate:not(.PCL--animated)')).forEach(e => {
                                const pos = e.getBoundingClientRect();
                                const centerTop = pos.top + pos.height/2;
                                const centerLeft = pos.left + pos.width/2;

                                if (Math.hypot(Math.abs(centerTop - top), Math.abs(centerLeft - left)) <= radius) {
                                    if (e.className.includes('PCL--icon')) {
                                        e.appendChild(
                                            this.icon = buildAnimatedIcon({
                                                [PasscodeLocker.Types.DEFAULT]: Gifs.LOCKED_INTRO,
                                                [PasscodeLocker.Types.SETTINGS]: Gifs.SETTINGS_INTRO,
                                                [PasscodeLocker.Types.EDITOR]: Gifs.EDIT_INTRO
                                            }[this.props.type], 64)
                                        );

                                        e.classList.remove('PCL--animate');
                                    }
                                    else e.classList.add('PCL--animated');
                                }
                            });
                        }, 10);

                        const listener = () => {
                            this.bg.removeEventListener('webkitTransitionEnd', listener);

                            clearInterval(i);
                            Array.from(document.querySelectorAll('.PCL--animate')).forEach(e => e.classList.remove('PCL--animate', 'PCL--animated'));
                            this.bgFill();
                        };
                        this.bg.addEventListener('webkitTransitionEnd', listener);
                    }, 100);
                }

                render() {
                    const btns = ['', 'ABC', 'DEF', 'GHI', 'JKL', 'MNO', 'PQRS', 'TUV', 'WXYZ'].map(
                        (dec, i) => React.createElement(
                            PasscodeBtn,
                            {
                                number: i + 1,
                                dec,
                                click: this.codeAppend
                            }
                        )
                    );

                    const titleText = () => {
                        if (this.props.type === PasscodeLocker.Types.EDITOR) return !this.state.confirm ? Locale.current.ENTER_NEW_PASSCODE : Locale.current.RE_ENTER_PASSCODE;
                        return Locale.current.ENTER_PASSCODE;
                    };

                    return React.createElement(
                        'div',{ id: this.props.plugin.getName(),className: 'PCL--layout'},[
                            React.createElement(
                              'div',{ className: 'PCL--layout-bg-img-cnt'},[
                                  React.createElement(
                                  'img',{class: 'PCL--layout-bg-img', src:`${this.get_background()}`}),]
                            ),
                            React.createElement(
                                'div',
                                { className: 'PCL--layout-bg' }),
                            React.createElement(
                                'div',{ className: 'PCL--controls' },[
                                    React.createElement(
                                        'div',{ className: 'PCL--header' },[
                                            React.createElement(
                                                'div',{ className: 'PCL--icon PCL--animate' }
                                            ),
                                            React.createElement(
                                                'div',
                                                { className: 'PCL--title PCL--animate' },
                                                titleText()
                                            ),
                                            React.createElement(
                                                'div',
                                                { className: 'PCL--dots PCL--animate' },
                                                Array(MAX_CODE_LENGTH).fill(null).map((_, i) => {
                                                    return React.createElement(
                                                        'div',
                                                        { className: `PCL--dot ${i < this.state.code.length ? 'PCL--dot-active' : ''}` }
                                                    );
                                                })
                                            )
                                        ]
                                    ),
                                    React.createElement(
                                        'div',
                                        { className: 'PCL--buttons' },
                                        [
                                            React.createElement('div', { className: 'PCL--divider PCL--animate' }),
                                            React.createElement('div', { className: `PCL--delay ${this.state.delay && 'PCL--delay--visible'}` }, `Too many tries.\nPlease try again in ${this.state.delayLeft} ${this.state.delayLeft > 1 ? 'seconds' : 'second'}.`),
                                            ...btns,
                                            this.buildCancelButton(),
                                            React.createElement(PasscodeBtn, { number: 0, dec: '+', click: this.codeAppend }),
                                            this.buildBackspaceButton(),
                                            ...([PasscodeLocker.Types.SETTINGS, PasscodeLocker.Types.EDITOR].includes(this.props.type) && CODE_LENGTH === -1 ?
                                                [React.createElement('div'), this.buildEnterButton()]
                                                : [])
                                        ]
                                    ),
                                ]
                            )
                        ]
                    )
                }
            }

            const KeybindListener = new class {

                constructor() {
                    this.pressedKeys = [];
                    this.listening = false;
                    this.listeners = [];
                }

                start() {
                    this.pressedKeys = [];

                    this.keyDownListener = e => {
                        if (e.repeat) return;

                        const key = e.code.slice(0, -1) === 'Key' ? e.code.slice(-1).toLowerCase() : e.key;
                        if (!this.pressedKeys.includes(key)) this.pressedKeys.push(key);
                        this.processPressedKeys();
                    }
                    this.keyUpListener = e => this.pressedKeys = this.pressedKeys.filter(key => key !== e.key);
                    this.windowBlurListener = () => this.pressedKeys = [];
                    window.addEventListener('keydown', this.keyDownListener);
                    window.addEventListener('keyup', this.keyUpListener);
                    window.addEventListener('blur', this.windowBlurListener);

                    this.listening = true;
                }

                stop(clearListeners = false) {
                    if (clearListeners) this.unlistenAll();

                    this.pressedKeys = [];
                    window.removeEventListener('keydown', this.keyDownListener);
                    window.removeEventListener('keyup', this.keyUpListener);
                    window.removeEventListener('blur', this.windowBlurListener);

                    this.listening = false;
                }

                processPressedKeys() {
                    this.listeners.forEach(({ keybind, handler }) => {
                        if (keybind.sort().join('|').toLowerCase() === this.pressedKeys.sort().join('|').toLowerCase()) handler(keybind);
                    });
                }

                listen(keybind, handler) {
                    this.listeners.push({ keybind, handler });
                }

                unlisten(keybind, handler = null) {
                    this.listeners.splice(this.listeners.findIndex(l => l.keybind.join('|').toLowerCase() === keybind.join('|').toLowerCase() && (handler === null || l.handler === handler)), 1);
                }

                unlistenAll() {
                    this.listeners = [];
                }

                updateKeybinds(currentKeybind, newKeybind) {
                    this.listeners.forEach(l => { if (l.keybind.join('|').toLowerCase() === currentKeybind.join('|').toLowerCase()) l.keybind = newKeybind; });
                }

            }();

            const VoiceProtector = new class {

                constructor() {
                    this._willPlaySound = false;
                }

                get willPlaySound() {
                    return this._willPlaySound;
                }
                set willPlaySound(value) {
                    this._willPlaySound = value;
                    if (value) setTimeout(() => this._willPlaySound = false);
                }

                get autoDeafened() {
                    return Data.autoDeafened;
                }
                set autoDeafened(value) {
                    return Data.autoDeafened = value;
                }

                deafIfNeeded() {
                    if (VoiceInfo.isSelfDeaf()) return;

                    this.willPlaySound = true;
                    VoiceActions.toggleSelfDeaf();
                    this.autoDeafened = true;
                }

                undeafIfNeeded() {
                    if (!this.autoDeafened) return;
                    this.autoDeafened = false;

                    if (!VoiceInfo.isSelfDeaf()) return;
                    this.willPlaySound = true;
                    VoiceActions.toggleSelfDeaf();
                }

            }();

            const WindowFocusMocker = new class {

                constructor () {
                    this.stop()
                }

                _dispatch (focused) {
                    const execute = v => Dispatcher.dispatch({
                        type: 'WINDOW_FOCUS',
                        windowId: getMainWindowId(),
                        focused: v
                    })
                    // Toggle for store to register update
                    execute(!focused)
                    execute(focused)
                }

                mock (focused) {
                    this.mocking = true
                    this.mockValue = focused
                    this._dispatch(focused)
                }

                stop () {
                    this.mocking = false
                    this.mockValue = null
                    this._dispatch(true)
                }

            }

            return class PasscodeLock extends Plugin {
                static Types = {
                    FOUR_DIGIT: '4-digit',
                    SIX_DIGIT: '6-digit',
                    CUSTOM_NUMERIC: 'custom-numeric',
                    CUSTON_ALPHANUMERIC: 'custom-alphanumeric'
                }

                getIconPath() {
                    return 'M4463 10384 c-16 -44 -191 -490 -333 -849 -39 -99 -98 -247 -130 -330 -32 -82 -91 -231 -130 -330 -39 -99 -102 -259 -140 -355 -38 -96 -101 -256 -140 -355 -39 -99 -97 -247 -130 -330 -32 -82 -91 -231 -130 -330 -39 -99 -98 -247 -130 -330 -32 -82 -91 -231 -130 -330 -39 -99 -96 -245 -128 -324 l-56 -145 239 -232 c174 -169 242 -229 248 -219 4 8 145 368 312 802 168 433 312 804 320 823 8 19 116 298 240 620 125 322 228 586 229 588 2 1 29 -66 61 -150 32 -84 63 -163 69 -176 12 -22 14 -21 181 84 94 58 177 113 186 123 9 9 35 72 58 140 l40 124 -291 741 c-160 407 -295 745 -299 750 -5 5 -11 1 -16 -10z M5095 8588 c-46 -122 -101 -308 -92 -308 17 0 198 47 203 53 5 5 -95 267 -102 267 -3 0 -7 -6 -9 -12z M4840 8434 c-74 -46 -138 -88 -143 -93 -8 -8 94 -293 113 -314 4 -5 45 102 90 238 45 135 80 248 79 250 -2 2 -65 -35 -139 -81z M5185 8224 c-71 -19 -131 -36 -132 -38 -9 -8 -153 -452 -153 -470 0 -15 610 -1610 625 -1633 0 -1 119 -27 262 -56 l262 -54 68 38 c37 21 72 40 76 42 5 1 -43 133 -106 292 -62 160 -146 371 -185 470 -80 204 -209 532 -305 775 -36 91 -104 264 -151 385 -100 255 -113 285 -123 284 -5 0 -66 -16 -138 -35z M2827 6153 c-3 -5 -84 -208 -180 -453 -198 -502 -260 -645 -348 -798 -329 -571 -724 -834 -1232 -820 l-128 3 -135 -239 c-74 -131 -133 -240 -132 -241 3 -2 1371 718 2107 1107 l193 103 163 420 c89 231 165 429 169 441 5 17 -34 59 -233 252 -132 128 -242 229 -244 225z M6175 5875 c-143 -73 -264 -140 -268 -147 -5 -8 166 -460 468 -1238 263 -674 495 -1274 517 -1335 55 -153 86 -288 100 -437 l12 -127 306 -299 c168 -164 311 -302 318 -306 15 -9 96 58 247 205 270 262 563 359 842 280 40 -12 75 -21 77 -21 2 0 -9 33 -26 73 -73 179 -126 401 -149 622 -14 144 -7 426 16 570 31 204 113 493 173 612 43 85 43 85 -100 13 -230 -115 -416 -162 -638 -162 -248 0 -433 57 -648 199 -302 200 -546 559 -777 1143 -48 124 -111 283 -139 354 -28 71 -56 131 -61 132 -6 2 -127 -57 -270 -131z M5610 5977 c0 -2 30 -80 71 -185 9 -22 10 -22 140 43 72 37 129 69 126 71 -7 8 -337 77 -337 71z M2858 4616 c-87 -45 -161 -86 -165 -89 -3 -4 54 -7 128 -7 l134 0 33 87 c18 47 31 87 30 89 -2 1 -74 -35 -160 -80z M420 4368 c68 -146 128 -351 167 -571 l18 -98 142 253 c160 285 160 286 142 292 -170 50 -276 90 -378 142 -69 35 -126 64 -127 64 -2 0 15 -37 36 -82z M2185 4216 c-192 -102 -351 -188 -352 -193 -4 -13 797 -358 806 -347 8 8 281 707 281 719 0 3 -87 5 -192 5 l-193 0 -350 -184z M1406 3881 c-147 -78 -150 -80 -293 -222 -79 -79 -234 -237 -343 -350 l-199 -206 -17 -104 c-21 -139 -66 -307 -114 -436 -22 -59 -38 -108 -36 -110 2 -2 39 6 82 19 109 30 259 31 367 0 166 -47 312 -137 472 -292 289 -279 608 -502 1042 -727 l161 -84 45 133 44 134 -60 64 c-175 191 -290 405 -338 630 -32 149 -32 370 0 529 29 147 55 230 158 495 46 120 83 220 81 221 -10 10 -875 385 -888 385 -8 -1 -82 -36 -164 -79z M793 3557 l-213 -112 0 -110 0 -110 166 165 c146 145 273 281 262 280 -1 0 -99 -51 -215 -113z M40 2362 c0 -11 198 -240 327 -377 323 -347 732 -693 1133 -962 220 -147 610 -370 628 -359 16 9 65 157 56 166 -5 4 -58 29 -119 55 -60 26 -191 89 -290 139 -562 290 -1077 676 -1582 1188 -84 85 -153 152 -153 150z M7022 2258 c-6 -40 -14 -83 -18 -95 -6 -23 -6 -23 117 -23 l124 0 -99 93 c-54 50 -102 93 -105 95 -4 1 -12 -31 -19 -70z M8750 1919 c-212 -212 -364 -350 -557 -504 -62 -49 -113 -92 -113 -96 0 -3 11 -16 25 -29 l24 -23 33 25 c78 60 375 347 504 489 145 157 299 338 293 342 -2 1 -96 -91 -209 -204z M6930 1972 c-139 -311 -478 -625 -909 -841 -215 -109 -535 -228 -819 -306 -165 -46 -92 -39 178 15 567 114 1170 335 1655 605 116 64 457 283 530 340 19 15 14 20 -105 140 l-125 125 -185 0 -185 0 -35 -78z M2786 1573 c-20 -59 -33 -110 -28 -114 16 -16 299 -125 492 -189 328 -110 764 -217 955 -235 54 -5 50 -3 -50 24 -361 97 -644 205 -903 343 -116 61 -296 176 -367 232 -22 18 -45 35 -52 39 -7 5 -23 -28 -47 -100z M7754 1289 c-226 -161 -492 -319 -758 -450 -855 -422 -1721 -536 -2216 -292 -115 57 -230 163 -276 255 l-29 57 -34 -64 c-120 -233 -468 -375 -915 -375 -293 0 -679 71 -1014 186 -73 25 -135 45 -137 43 -13 -15 -65 -172 -59 -179 12 -10 221 -102 331 -144 422 -163 825 -261 1248 -301 336 -32 936 -27 1263 10 900 105 1811 507 2640 1168 61 49 112 93 112 97 0 3 -13 18 -28 33 l-28 27 -100 -71z';
                }

                buildStaticIcon() {
                    return React.createElement(
                        'svg',
                        {
                            xmlns: 'http://www.w3.org/2000/svg',
                            viewBox: '0 0 2400.000000 2400.000000',
                            height: '64',
                            width: '64',
                            preserveAspectRatio: 'xMidYMid meet',
                        },
                        React.createElement('path', { fill: 'currentColor', d: this.getIconPath() })
                    );
                }

                lock({ button, type, onSuccess } = {}) {
                    type = type ?? PasscodeLocker.Types.DEFAULT;

                    if (this.locked) return;
                    if (this.settings.hash === -1 && type !== PasscodeLocker.Types.EDITOR) return Toasts.error(Locale.current.FIRST_SETUP_MESSAGE);

                    this.unlock(false, true);

                    this.element = document.createElement('div');
                    getContainer().appendChild(this.element);
                    ReactDOM.render(React.createElement(PasscodeLocker, { plugin: this, button, type, onSuccess }), this.element);
                    this.disableInteractions();

                    this.locked = true;
                    if (type === PasscodeLocker.Types.DEFAULT) {
                        VoiceProtector.deafIfNeeded();
                        Data.locked = true;
                    }
                }

                unlock(safeUnlock = false, preventiveUnlock = false) {
                    if (!preventiveUnlock) {
                        VoiceProtector.undeafIfNeeded();
                        Data.attempts = 0;
                        Data.delayUntil = null;
                    }
                    this.enableInteractions();
                    this.locked = false;
                    if (safeUnlock) Data.locked = false;

                    if (!this.element) return;

                    ReactDOM.unmountComponentAtNode(this.element);
                    this.element.remove();
                }

                disableInteractions() {
                    Keybinds.disable();
                    WindowFocusMocker.mock(false);
                }

                enableInteractions() {
                    Keybinds.enable();
                    WindowFocusMocker.stop();
                    document.onkeydown = null;
                }

                onLockKeybind() {
                    this.lock();
                }

                onStart() {
                    this.injectCSS();
                    this.patchPlaySound();
                    this.patchWindowInfo();
                    this.patchSettingsButton();
                    this.enableAutolock();

                    KeybindListener.start();
                    this.keybindSetting = this.checkKeybindLoad(this.settings.keybind);
                    this.keybind = this.keybindSetting.split('+');
                    KeybindListener.listen(this.keybind, () => this.onLockKeybind());

                    if (this.settings.lockOnStartup || Data.locked) this.lock();
                }

                patchPlaySound() {
                    Patcher.instead(SoundActions, 'playSound', (_, props, original) => {
                        if (!props[0]?.endsWith('deafen') || !VoiceProtector.willPlaySound) return original(...props);
                        VoiceProtector.willPlaySound = false;
                        return false;
                    });
                }

                patchWindowInfo() {
                    Patcher.instead(WindowInfo, 'isFocused', (self, props, original) => {
                        if (WindowFocusMocker.mocking) return WindowFocusMocker.mockValue
                        return original(...props)
                    })
                }

                injectCSS() {
                    DOM.addStyle(this.getName()+'-style', `
                    .PCL--layout {
                        --main-color: #dcddde;
                        position: absolute;
                        top: 0;
                        left: 0;
                        height: 100%;
                        width: 100%;
                        z-index: 2999;
                        overflow: hidden;
                        color: var(--main-color);
                    }
                    .PCL--layout-bg-img-cnt {
                        height: 100%;
                        width: 100%;
                    }
                    .PCL--layout-bg-img {
                        min-height: 100%;
                        min-width: 100%;
                        aspect-ratio: auto;
                        overflow: hidden;
                        width: auto;
                        height: auto;
                        margin: 0;
                        padding: 0;
                    }
                    .PCL--layout-bg {
                        position: absolute;
                        height: 100%;
                        width: 100%;
                        background-color: rgba(0, 0, 0, .5);
                        backdrop-filter: blur(1px);
                        transition: ${BG_TRANSITION / 1000}s transform linear;
                        border-radius: 50%;
                    }

                    .PCL--controls {
                        position: absolute;
                        top: 50%;
                        left: 50%;
                        transform: translate(-50%, -50%);
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        justify-content: stretch;
                        user-select: none;
                        transition: .3s opacity;
                    }

                    .PCL--header {
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        padding-bottom: 22px;
                    }

                    .PCL--icon {
                        height: 64px;
                        width: 64px;
                    }

                    .PCL--title {
                        margin: 25px 0 25px;
                    }

                    .PCL--dots {
                        display: flex;
                        height: 8px;
                        width: 100%;
                        justify-content: center;
                    }

                    @keyframes PCL--limit {
                        0% {transform: translateX(10px);}
                        25% {transform: translateX(0px);}
                        50% {transform: translateX(-10px);}
                        100% {transform: translateX(0px);}
                    }

                    .PCL--dots.PCL--dots--limit {
                        animation-name: PCL--limit;
                        animation-duration: 250ms;
                    }

                    .PCL--dot {
                        position: relative;
                        height: 8px;
                        width: 0;
                        /*animation-name: PCL--dot--anim;
                        animation-duration: 250ms;*/
                        transition: .25s opacity, .25s transform, .25s width, .25s margin;
                        opacity: 0;
                        transform: scale(.5);
                    }
                    .PCL--dot::before {
                        content: '';
                        position: absolute;
                        top: 0;
                        left: 50%;
                        transform: translateX(-50%);
                        height: 8px;
                        width: 8px;
                        border-radius: 50%;
                        background: var(--main-color);
                    }
                    .PCL--dot-active {
                        opacity: 1;
                        transform: scale(1);
                        width: 8px;
                        margin: 0 5px;
                    }

                    .PCL--buttons {
                        display: grid;
                        grid-template-columns: repeat(3, 60px);
                        grid-auto-rows: 60px;
                        gap: 30px;
                        padding: 40px 20px;
                        position: relative;
                    }

                    .PCL--divider {
                        position: absolute;
                        top: 0;
                        left: 0;
                        width: 100%;
                        height: 1px;
                        background: rgba(255, 255, 255, .1);
                    }

                    .PCL--btn {
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        justify-content: center;
                        cursor: pointer;
                        border-radius: 50%;
                        box-sizing: border-box;
                        background-clip: padding-box;
                        border: 1px solid transparent;
                        transition: 1s border-color, .3s background-color;
                    }

                    .PCL--btn:active, .PCL--btn-active {
                        transition: none;
                        border-color: rgba(255, 255, 255, .15);
                        background-color: rgba(255, 255, 255, .15);
                    }

                    .PCL--btn-number {
                        font-size: 32px;
                        font-weight: 500;
                        line-height: 36px;
                    }

                    .PCL--btn-dec {
                        height: 11px;
                        font-size: 10px;
                        text-transform: uppercase;
                        color: rgba(255, 255, 255, .3);
                    }

                    .PCL--animate {
                        transition: .3s transform, .3s opacity;
                        transition-timing-function: cubic-bezier(0.33, 1, 0.68, 1);
                        transform: scale(.7);
                        opacity: 0;
                    }

                    .PCL--animated {
                        transform: scale(1);
                        opacity: 1;
                    }

                    .PCL--delay {
                        display: none;
                        position: absolute;
                        top: 55px;
                        left: 50%;
                        transform: translateX(-50%);
                        width: max-content;
                        white-space: pre-wrap;
                        line-height: 1.2;
                        text-align: center;
                    }
                    .PCL--delay--visible {
                        display: block;
                    }
                    .PCL--delay--visible ~ * {
                        opacity: 0;
                        pointer-events: none;
                    }
`);
                }

                clearCSS() {
                    DOM.removeStyle(this.getName()+'-style');
                }

                onStop() {
                    this.unlock();
                    this.clearCSS();
                    this.disconnectObserver();
                    this.unpatchSettingsButton();
                    this.disableAutolock();
                    KeybindListener.stop(true);
                    Patcher.unpatchAll();
                }

                patchSettingsButton() {
                    const selector = `#${this.getName()}-card`;
                    const callback = e => {
                        let node;
                        if ((node = e?.querySelector(`#${this.getName()}-card .bd-controls > .bd-button:first-child`))) {
                            const patchedNode = node.cloneNode(true);
                            patchedNode.onclick = () => {
                                if (!BdApi.Plugins.isEnabled(this.getName())) return;

                                if (this.settings.hash === -1) return node.click();

                                this.lock({
                                    button: patchedNode,
                                    type: PasscodeLocker.Types.SETTINGS,
                                    onSuccess: () => node.click()
                                });
                            };

                            patchedNode.classList.remove('bd-button-disabled');
                            node.before(patchedNode);
                            node.style.display = 'none';

                            this.settingsButton = { node, patchedNode };
                        }
                    };
                    callback(document.querySelector(selector));

                    this.observer = new DOMTools.DOMObserver();
                    this.observer.subscribeToQuerySelector(e => callback(e.addedNodes[0]), selector, this, false);
                }

                unpatchSettingsButton() {
                    if (this.settingsButton?.node) this.settingsButton.node.style.display = null;
                    if (this.settingsButton?.patchedNode) this.settingsButton.patchedNode.remove();
                }

                disconnectObserver() {
                    this.observer.unsubscribeAll();
                }

                async updateCode(code) {
                    const hashed = await hashCode(code)
                    this.settings.hash = hashed.hash;
                    this.settings.salt = hashed.salt;
                    this.settings.iterations = hashed.iterations;
                    this.saveSettings();

                    Toasts.success(Locale.current.PASSCODE_UPDATED_MESSAGE);
                }

                enableAutolock() {
                    this.autolockBlurListener = e => {
                        if (this.settings.autolock === false || getVoiceChannelId() !== null) return;

                        this.autolockTimeout = setTimeout(() => {
                            this.onLockKeybind();
                        }, this.settings.autolock * 1000);
                    };
                    this.autolockFocusListener = e => {
                        clearTimeout(this.autolockTimeout);
                    };

                    window.addEventListener('blur', this.autolockBlurListener);
                    window.addEventListener('focus', this.autolockFocusListener);
                }

                disableAutolock() {
                    clearTimeout(this.autolockTimeout);
                    window.removeEventListener('blur', this.autolockBlurListener);
                    window.removeEventListener('focus', this.autolockFocusListener);
                }

                getSettingsPanel() {
                    if (!this.KeybindRecorder) {
                        this.KeybindRecorder = WebpackModules.getModule(m => m.prototype?.handleComboChange);
                    }

                    const Buttons = (...props) => {
                        class Panel extends React.Component {
                            render() {
                                let buttons = [];
                                props.forEach(p => {
                                    buttons.push(
                                        React.createElement(Button, {
                                            style: {
                                                display: 'inline-flex',
                                                marginRight: '10px',
                                                ...(p.icon ? {
                                                    paddingLeft: '10px',
                                                    paddingRight: '12px',
                                                } : {})
                                            },
                                            ...p
                                        })
                                    );
                                });

                                return React.createElement(
                                    'div',
                                    {},
                                    buttons
                                );
                            }
                        }

                        return Panel;
                    }

                    const ButtonIcon = (name, text) => {
                        const icon = {
                            edit: `M3 17.46v3.04c0 .28.22.5.5.5h3.04c.13 0 .26-.05.35-.15L17.81 9.94l-3.75-3.75L3.15 17.1c-.1.1-.15.22-.15.36zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z`,
                            lock: this.getIconPath()
                        }[name];

                        return React.createElement(
                            'div',
                            {
                                style: {
                                    display: 'flex',
                                    alignItems: 'center'
                                }
                            },
                            [
                                React.createElement(
                                    'svg',
                                    {
                                        xmlns: 'http://www.w3.org/2000/svg',
                                        height: '20',
                                        viewBox: '0 0 24 24',
                                        width: '20'
                                    },
                                    React.createElement('path', { d: icon, fill: 'white' })
                                ),
                                React.createElement('span', { style: { marginLeft: '5px' } }, text)
                            ]
                        );
                    };

                    const settingsNode = Settings.SettingPanel.build(
                        () => {
                            this.saveSettings.bind(this);
                        },

                        new Settings.SettingField(null, null, () => {}, Buttons(
                            {
                                children: ButtonIcon('edit', Locale.current.EDIT_PASSCODE),
                                icon: true,
                                color: Button.Colors.BRAND,
                                size: Button.Sizes.SMALL,
                                id: `PCLSettingsEditButton`,
                                onClick: () => this.lock({
                                    button: document.getElementById('PCLSettingsEditButton'),
                                    type: PasscodeLocker.Types.EDITOR
                                })
                            },
                            {
                                children: ButtonIcon('lock', Locale.current.LOCK_DISCORD),
                                icon: true,
                                color: Button.Colors.TRANSPARENT,
                                size: Button.Sizes.SMALL,
                                id: `PCLSettingsLockButton`,
                                onClick: () => this.lock({
                                    button: document.getElementById('PCLSettingsLockButton')
                                })
                            },
                        )),

                        // Inspired by iOS code options
                        new Settings.RadioGroup(Locale.current.CODE_TYPE_SETTING, null, this.settings.codeType, [
                            {
                                name: Locale.current['4DIGIT_NCODE'],
                                value: PasscodeLock.Types.FOUR_DIGIT
                            },
                            {
                                name: Locale.current['6DIGIT_NCODE'],
                                value: PasscodeLock.Types.SIX_DIGIT
                            },
                            {
                                name: Locale.current.CUSTOM_NCODE,
                                value: PasscodeLock.Types.CUSTOM_NUMERIC
                            },
                            // TODO: implement
                            // {
                            //     name: 'Custom Alphanumeric Code',
                            //     value: PasscodeLock.Types.CUSTON_ALPHANUMERIC
                            // },
                        ], e => {
                            this.settings.codeType = e;
                            this.saveSettings();

                            this.settings.hash = -1;
                            Toasts.warning(Locale.current.PASSCODE_RESET_DEFAULT_MESSAGE);

                            CODE_LENGTH = (this.settings.codeType === PasscodeLock.Types.FOUR_DIGIT ? 4 :
                                this.settings.codeType === PasscodeLock.Types.SIX_DIGIT ? 6 : -1);
                        }),

                        // new Settings.RadioGroup(Locale.current.AUTOLOCK_SETTING, Locale.current.AUTOLOCK_DESC, this.settings.autolock, [
                        //     {
                        //         name: Locale.current.AUTOLOCK_DISABLED,
                        //         value: false
                        //     },
                        //     {
                        //         name: Locale.current.AUTOLOCK_1M,
                        //         value: 60
                        //     },
                        //     {
                        //         name: Locale.current.AUTOLOCK_5M,
                        //         value: 60 * 5
                        //     },
                        //     {
                        //         name: Locale.current.AUTOLOCK_1H,
                        //         value: 60 * 60
                        //     },
                        //     {
                        //         name: Locale.current.AUTOLOCK_5H,
                        //         value: 60 * 60 * 5
                        //     },
                        // ], e => {
                        //     this.settings.autolock = e;
                        //     this.saveSettings();
                        // }),

                        new Settings.Slider(Locale.current.AUTOLOCK_SETTING, Locale.current.AUTOLOCK_DESC, -800, 5*60*60, this.settings.autolock === false ? -800 : this.settings.autolock, e => {
                            this.settings.autolock = e < 0 ? false : e;
                            this.saveSettings();
                        }, {
                            markers: [
                                -800,
                                60,
                                5 * 60,
                                ...Array.from({ length: 4 }, (_, i) => (15 + i * 15) * 60),
                                ...Array.from({ length: 4 }, (_, i) => (2 + i) * 60 * 60),
                            ],
                            stickToMarkers: true,
                            renderMarker: e => e === -800 ? 'OFF' : e < 60 * 60 ? `${e / 60}${e < 10 * 60 ? '' : 'm'}` : `${e / 60 / 60}h`
                        }),

                        new Settings.SettingField(Locale.current.LOCK_KEYBIND_SETTING, null, () => {}, props => {
                            return React.createElement(this.KeybindRecorder, {
                                defaultValue: KeybindStore.toCombo(this.keybindSetting.replace("control", "ctrl")),
                                onChange: (e) => {
                                    const keybindString = KeybindStore.toString(e).toLowerCase().replace("ctrl", "control");

                                    KeybindListener.unlisten(this.keybind);
                                    this.keybindSetting = keybindString;
                                    this.keybind = keybindString.split('+');
                                    KeybindListener.listen(this.keybind, () => this.onLockKeybind());

                                    this.settings.keybind = this.keybindSetting;
                                    this.saveSettings();
                                }
                            })
                        }),

                        new Settings.Switch(Locale.current.ALWAYS_LOCK_SETTING, Locale.current.ALWAYS_LOCK_DESC, this.settings.lockOnStartup, e => {
                            this.settings.lockOnStartup = e;
                            this.saveSettings();
                        }),

                        new Settings.Switch(Locale.current.HIGHLIGHT_TYPING_SETTING, Locale.current.HIGHLIGHT_TYPING_DESC, this.settings.highlightButtons, e => {
                            this.settings.highlightButtons = e;
                            this.saveSettings();
                        }),

                        new Settings.RadioGroup(Locale.current.NOTIFICATIONS_SETTING, null, this.settings.hideNotifications, [
                            {
                                name: Locale.current.NOTIFICATIONS_SETTING_DISABLE,
                                value: true
                            },
                            {
                                name: Locale.current.NOTIFICATIONS_SETTING_CENSOR,
                                value: false
                            },
                        ], e => {
                            this.settings.hideNotifications = e;
                            this.saveSettings();
                        }),

                        new Settings.SettingField(null, React.createElement(DiscordModules.TextElement, {
                            children: [
                                'Not your language? Help translate the plugin on the ',
                                React.createElement(Anchor, {
                                    children: 'Crowdin page',
                                    href: 'https://crwd.in/betterdiscord-passcodelock'
                                }),
                                '.'
                            ],
                            className: `${DiscordModules.TextElement.Colors.STANDARD} ${DiscordModules.TextElement.Sizes.SIZE_14}`
                        }), () => {}, document.createElement('div'))

                    );

                    DOMTools.onMountChange(settingsNode, () => KeybindListener.stop(), true);
                    DOMTools.onMountChange(settingsNode, () => KeybindListener.start(), false);

                    return settingsNode;
                }

                // Props to https://github.com/Farcrada (https://github.com/Farcrada/DiscordPlugins/blob/ed87e32c0e25960b3c76428b8929a9c6f5a1c20d/Hide-Channels/HideChannels.plugin.js)
                checkKeybindLoad(keybindToLoad, defaultKeybind = "control+l") {
                    defaultKeybind = defaultKeybind.toLowerCase().replace("ctrl", "control");

                    //If no keybind
                    if (!keybindToLoad)
                        return defaultKeybind;

                    //Error sensitive, so just plump it into a try-catch
                    try {
                        //If it's already a string, double check it
                        if (typeof (keybindToLoad) === typeof (defaultKeybind)) {
                            keybindToLoad = keybindToLoad.toLowerCase().replace("control", "ctrl");
                            //Does it go into a combo? (i.e.: is it the correct format?)
                            if (KeybindStore.toCombo(keybindToLoad))
                                return keybindToLoad.replace("ctrl", "control");
                            else
                                return defaultKeybind;
                        }
                        else
                            //If it's not a string, check if it's a combo.
                        if (KeybindStore.toString(keybindToLoad))
                            return KeybindStore.toString(keybindToLoad).toLowerCase().replace("ctrl", "control");
                    }
                    catch (e) { return defaultKeybind; }
                }

                constructor() {
                    super();

                    this.defaultSettings = {
                        codeType: PasscodeLock.Types.FOUR_DIGIT,
                        hash: -1,
                        salt: null,
                        iterations: null,
                        autolock: false,
                        keybind: "control+l",
                        highlightButtons: false,
                        lockOnStartup: true,
                        hideNotifications: false
                    };

                    this.settings = this.loadSettings(this.defaultSettings);

                    if (this.settings.code || [10000, 1000].includes(this.settings.iterations)) {
                        delete this.settings.code;
                        ['hash', 'salt', 'iterations'].forEach(k => this.settings[k] = this.defaultSettings[k]);
                        this.saveSettings();

                        Toasts.warning(Locale.current.PASSCODE_RESET_SECURITY_UPDATE_MESSAGE);
                    }
                    if (typeof this.settings.keybind !== 'string') {
                        this.settings.keybind = this.defaultSettings.keybind;
                        this.saveSettings();
                    }

                    CODE_LENGTH = (this.settings.codeType === PasscodeLock.Types.FOUR_DIGIT ? 4 :
                        this.settings.codeType === PasscodeLock.Types.SIX_DIGIT ? 6 : -1);

                    if (!Data.hasShownAttention) this.showAttentionModal();
                }

                showAttentionModal() {
                    const that = this;
                    class Modal extends React.Component {
                        render() {
                            return React.createElement(ConfirmationModal, Object.assign({
                                    header: `${that.getName()}`,
                                    confirmButtonColor: ButtonData.Colors.BRAND,
                                    className: Selectors.Modals.small,
                                    confirmText: 'Got it',
                                    cancelText: null,
                                    style: {
                                        lineHeight: '1.4em',
                                    }
                                }, this.props),
                                [
                                    React.createElement(
                                        'div',
                                        {
                                            style: {
                                                lineHeight: '1.4em',
                                            }
                                        },
                                        React.createElement(
                                            Markdown,
                                            null,
                                            Locale.current.ATTENTION_MESSAGE
                                        )
                                    )
                                ]
                            );
                        }
                    }

                    ModalActions.openModal(props => {
                        return React.createElement(Modal, props)
                    });

                    Data.hasShownAttention = true;
                }
            }
        }

        return plugin(Plugin, Api);
    })(global.ZeresPluginLibrary.buildPlugin(config));
})();
