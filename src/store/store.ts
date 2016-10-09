import { Mode, State, SizeMode } from "../model/model";
import { ActionsHub } from "../actions/actions";

import { Markdown } from "../services/markdown";

export interface IStoreListener {
    (): void;
}

export class Store {
    private _listeners: IStoreListener[] = [];

    protected _fire() {
        for (let listener of this._listeners) {
            listener();
        }
    }

    public addListener(listener: IStoreListener) {
        this._listeners.push(listener);
    }

    public removeListener(listener: IStoreListener) {
        const idx = this._listeners.indexOf(listener);
        if (-1 !== idx) {
            this._listeners.splice(idx, 1);
        }
    }
}

export class MainStore extends Store {
    private _originalMarkdown: string;

    private _fieldName: string;
    private _minHeight: number;
    private _maxHeight: number;

    private _height: number;
    private _sizeMode: SizeMode = SizeMode.Default;

    private _markdownContent: string;
    private _htmlContent: string;

    private _state: State = State.Preview;
    private _mode: Mode = Mode.None;

    private _pendingStores: number = 0;

    constructor(private _actionsHub: ActionsHub, fieldName: string, minHeight: number, maxHeight: number) {
        super();

        this._setupServices();

        this._fieldName = fieldName;
        this._minHeight = minHeight;
        this._maxHeight = maxHeight;

        this._subscribeToActions();
    }

    protected _setupServices() {
    }

    public getFieldName(): string {
        return this._fieldName;
    }

    public getOutput(): string {
        this._pendingStores++;

        return Markdown.buildOutput(this._markdownContent || "");
    }

    public getState(): State {
        return this._state;
    }

    public getMode(): Mode {
        return this._mode;
    }

    public getHeight(): number {
        return this._height;
    }

    public canGrow(): boolean {
        return this._sizeMode === SizeMode.AutoGrow && this._height < this._maxHeight;
    }

    public getMaxHeight(): number {
        return this._maxHeight;
    }

    public getMinHeight(): number {
        return this._minHeight;
    }

    public getSizeMode(): SizeMode {
        return this._sizeMode;
    }

    public getMarkdown(): string {
        return this._markdownContent;
    }

    public getHtmlContent(): string {
        return this._htmlContent;
    }

    public isChanged(): boolean {
        return this._originalMarkdown !== this._markdownContent;
    }

    private _subscribeToActions() {
        this._actionsHub.setContentFromWorkItem.addListener(this._onSetContentFromWorkItem.bind(this));
        this._actionsHub.setMarkdownContent.addListener(this._onSetMarkdownContent.bind(this));

        this._actionsHub.toggleState.addListener(this._onToggleState.bind(this));
        this._actionsHub.toggleSizeMode.addListener(this._onToggleSizeMode.bind(this));
        this._actionsHub.resize.addListener(this._onResize.bind(this));
        this._actionsHub.reset.addListener(this._onReset.bind(this));
    }

    private _onReset() {
        this._originalMarkdown = this._markdownContent;
    }

    private _onResize(height: number) {
        if (this._state === State.Preview) {
            height += 45;
        } else {
            height += 25;
        }

        this._height = Math.min(this._maxHeight, Math.max(this._minHeight, height));

        this._fire();
    }

    private _onSetMarkdownContent(markdownContent: string) {
        this._markdownContent = markdownContent;
        this._htmlContent = Markdown.renderMarkdown(this._markdownContent);

        this._fire();
    }

    private _onToggleState() {
        this._state = this._state === State.Editor ? State.Preview : State.Editor;

        this._fire();
    }

    private _onToggleSizeMode() {
        this._sizeMode = this._sizeMode === SizeMode.AutoGrow ? SizeMode.Default : SizeMode.AutoGrow;

        if (this._sizeMode === SizeMode.Default) {
            this._onResize(this._minHeight);
        }

        this._fire();
    }

    private _onSetContentFromWorkItem(rawInput: string) {
        if (this._pendingStores > 0) {
            --this._pendingStores;
            return;
        }

        const { markdownContent, htmlContent } = Markdown.extractMarkdown(rawInput);

        if (!markdownContent && !htmlContent) {
            this._mode = Mode.Markdown;
            this._markdownContent = "";
            this._htmlContent = "";
        } else if (markdownContent) {
            if (Markdown.compare(markdownContent, htmlContent)) {
                // Content was changed in legacy editor
                this._mode = Mode.MarkdownModified;
            } else {
                // Match
                this._mode = Mode.Markdown;
            }

            this._markdownContent = markdownContent;
            this._htmlContent = htmlContent;
        } else {
            // No markdown content
            this._mode = Mode.Legacy;
            this._htmlContent = rawInput;
        }

        // Store original value
        if (!this._originalMarkdown) {
            this._onReset();
        }

        this._fire();
    }
}