import Chart from 'chart.js';
import chartCSS from './chartslide.css';
import * as ColorMath from "color-math";

class ChartSlideController {
  
  /** The slide element (usually, a `section`) managed by this controller. */
  slideElem;
  /** The canvas element placed inside the slide to draw the chart. */
  canvasElem;
  /** A bidimensional array containing the information of the HTML table */
  data;
  /** An array of HTMLImageElements extracted from the foot-notes of each column */
  datacards;
  /** A JSON structure describing the chart, as defined by chart.js */
  config;
  /** The actual chart. */
  chart;

  constructor(slideElem) {
    this.slideElem = slideElem;
    this.#initCanvas();
    this.#initCards();
    this.#initConfig();
    this.#createChart();
    document.addEventListener('partialShown', (evt) => this.#showNextDataPoint(evt), true);
  }

  #initCanvas() {
    this.canvasElem = document.createElement('canvas');
    this.canvasElem.id = this.slideElem.id + '-chart-canvas';

    const siblingElem = this.slideElem.querySelector('h1,h2,h3');
    if (siblingElem) {
      siblingElem.insertAdjacentElement('afterend', this.canvasElem);
    } else {
      this.slideElem.appendChild(this.canvasElem);
    }
    return this.canvasElem;
  }

  #initCards() {
    const tableElem = this.slideElem.querySelector('table');

    this.datacards = [];
    // for each data row in the table
    [...tableElem.querySelectorAll('tbody tr')].forEach(
      // for each cell in this row
      (trElem, rowIdx) => [...trElem.querySelectorAll('td')]
        .forEach((tdElem, colIdx) => {
          const footNoteRef = tdElem.querySelector('sup a')?.href;
          if (footNoteRef === undefined) return;

          const footNoteId = footNoteRef.substring(footNoteRef.indexOf('#'));
          const footNoteImage = document.querySelector(`${footNoteId} img`);
          if (footNoteImage !== null) {
            this.datacards[rowIdx] = footNoteImage;
          }
        }
      )
    );
    return this.datacards;
  }

  #initConfig() {
    let config = {
      type: '',
      data: {
        labels: [],
        datasets: [
        ]
      },
      options: {
        title : {
          display : false,
          position : 'bottom'
        },
        responsive: true,
        scales: {
          xAxes: [{
            display: true,
            scaleLabel: {
            }
          }],
          yAxes: [{
            display: true,
            ticks : {
            },
            scaleLabel: {
            }
          }]
        }
      }
    };


    // optionsText = "type: line, netflix: red, blockbuster: blue, yAxesSuggestedMax: 6500";
    const optionsText = this.slideElem.dataset.chart;
    config._options = {};
    optionsText.split(',')
    .forEach(p=>{ 
      const kv = p.split(':'); 
      config._options[kv[0].trim()] = kv[1].trim() 
    });
    // config._options = { type: "line", netflix: "red", blockbuster: "blue", yAxesSuggestedMax: "6500" };

    config.type = config._options.type;
    if (config._options.type) config.type = config._options.type;
    if (config._options.yAxesSuggestedMax) config.options.scales.yAxes[0].ticks.suggestedMax = config._options.yAxesSuggestedMax;

    const tableElem = this.slideElem.querySelector('table');
    
    // First column includes the X axis labels
    config.data.labels = 
      [...tableElem.querySelectorAll('tr td:nth-child(1)')].map(e => e.innerText);

    for (let colIdx = 2; colIdx < tableElem.rows[0].cells.length+1; colIdx++) {
      const label = tableElem.querySelector(`th:nth-child(${colIdx})`).innerText;
      const color = config._options[label] ? config._options[label] : '';
      let data = [];
      if (this.slideElem.classList.contains('partial') === false) {
        data = [...tableElem.querySelectorAll(`tbody tr td:nth-child(${colIdx})`)]
                         .map(e => parseFloat(e.innerText));
      }
      const dataset = {
        label,
        borderColor: color,
        backgroundColor : ColorMath.evaluate(`${color} @a 25%`).result.hex(),
        data
      };
      config.data.datasets.push(dataset);
    }
    this.config = config;
    return this.config;
  }

  #createChart() {
    const ctx = this.canvasElem.getContext('2d');
    this.chart = new Chart(ctx, this.config);
    
    return this.chart;
  }
  
  #showNextDataPoint(evt) {
    // return if not in the current slide    
    if (evt.detail.currentSlideElem !== this.slideElem) return;

    let rowIdx = evt.detail.lastPartialShownIndex;

    const tableElem = this.slideElem.querySelector('table');
    const tdElems = [...tableElem.querySelectorAll(`tbody tr:nth-child(${rowIdx}) td`)];

    this.config.data.datasets.forEach((ds, idx) => {
      const value = parseFloat(tdElems[idx+1].innerText);
      ds.data.push(value);
    });

    this.chart.update();
    this.#updateDataCard(rowIdx-1);
  }

  #updateDataCard(index) {
    if (this.datacardImgElem) {
      this.datacardImgElem.classList.add('past');
    }
    

    this.datacardImgElem = this.datacards[index]?.cloneNode();
    if (this.datacardImgElem === undefined) return;

    this.datacardImgElem.classList.add('datacard');
    this.canvasElem.insertAdjacentElement('beforebegin', this.datacardImgElem);

  }

}

export default ChartSlideController;