import { render } from './interaction-viewer';

var loadComponent = function() {
    class InteractionViewer extends HTMLElement {

        constructor() {
            super();
            this._accession = this.getAttribute('accession');
        }

        connectedCallback() {
            this._render();
        }

        attributeChangedCallback(attrName, oldVal, newVal) {
            if (attrName === 'accession') {
                this._accession = newVal;
                this._render();
            }
        }

        set accession(accession) {
            this._accession = accession;
        }

        get accession() {
            return this._accession;
        }

        _render() {
            render({
                el: this,
                accession: this._accession
            });
        }
    }
    customElements.define('interaction-viewer', InteractionViewer);
}

// Conditional loading of polyfill
if (window.customElements) {
    loadComponent();
} else {
    document.addEventListener('WebComponentsReady', function() {
        console.log('Loaded with polyfill.')
        loadComponent();
    });
}