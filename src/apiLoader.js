import _values from 'underscore-es/values';
import { addStringItem } from './treeMenu';

const subcellulartreeMenu = [];
const diseases = {};

function load(accession) {
    return fetch(`//www.ebi.ac.uk/proteins/api/proteins/interaction/${accession}.json`)
        .then(resp => resp.json()
            .then(json => process(json)));
}

function process(data) {
    // remove interactions which are not part of current set
    for (const element of data) {
        let interactors = [];
        element.filterTerms = [];

        // Add source  to the nodes
        for (const interactor of element.interactions) {
            // Add interaction for SELF
            if (interactor.interactionType === 'SELF') {
                interactor.source = element.accession;
                interactor.id = element.accession;
                interactors.push(interactor);
            }
            // TODO review this as it's not nice.
            // TODO also save the reverse??
            else if (data.some(function(d) { //Check that interactor is in the data
                    return d.accession === interactor.id;
                })) {
                interactor.source = element.accession;
                interactors.push(interactor);
            } else if (interactor.id.includes('-')) { //handle isoforms
                // TODO handle isoforms
                // console.log(interactor.id);
            }
        }
        element.interactions = interactors;

        if (element.subcellularLocations) {
            for (let location of element.subcellularLocations) {
                for (let actualLocation of location.locations) {
                    addStringItem(actualLocation.location.value, subcellulartreeMenu);
                    let locationSplit = actualLocation.location.value.split(', ');
                    element.filterTerms = element.filterTerms.concat(locationSplit);
                }
            }
        }
        if (element.diseases) {
            for (let disease of element.diseases) {
                if (disease.diseaseId) {
                    diseases[disease.diseaseId] = {
                        name: disease.diseaseId,
                        selected: false
                    };
                    element.filterTerms.push(disease.diseaseId);
                }
            }
        }
    }
    return data;
}

function getFilters() {
    return [{
        name: 'subcellularLocations',
        label: 'Subcellular location',
        type: 'tree',
        items: subcellulartreeMenu
    }, {
        name: 'diseases',
        label: 'Diseases',
        items: _values(diseases)
    }];
}

export { load, getFilters };