import Chart from 'chart.js';
import chartCSS from './chartslide.css';

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
    this.#initData();
    this.#initCards();
    this.#initConfig();
    this.#createChart();
    document.addEventListener('partialShown', (evt) => this.#showNextDataPoint(evt), true);
  }

  #initCanvas() {
    this.canvasElem = document.createElement('canvas');    
    const imgElem = this.slideElem.querySelector('img');
    imgElem.parentNode.appendChild(this.canvasElem, imgElem);
    return this.canvasElem;
  }

  #initData() {
    const tableElem = this.slideElem.querySelector('table');
    this.data = [];
    this.data[0] = [...tableElem.querySelectorAll('thead tr th')].map(e=>e.innerText);
    [...tableElem.querySelectorAll('tbody tr')].forEach(
      trElem => this.data.push([...trElem.querySelectorAll('td')].map(td=>td.innerText))
    );
    return this.data;
  }

  #initCards() {
    const tableElem = this.slideElem.querySelector('table');

    this.datacards = [];
    // for each data row in the table
    [...tableElem.querySelectorAll('tbody tr')].forEach(
      // for each cell in this row
      trElem => [...trElem.querySelectorAll('td')]
        .forEach((tdElem, idx) => {
          const footNoteRef = tdElem.querySelector('sup a')?.href;
          if (footNoteRef === undefined) return;

          const footNoteId = footNoteRef.substring(footNoteRef.indexOf('#'));
          const footNoteImage = document.querySelector(`${footNoteId} img`);
          if (footNoteImage !== null) {
            this.datacards[idx] = footNoteImage;
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
        labels: this.data[0].slice(1),
        datasets: [
        ]
      },
      options: {
        title : {
          display : true,
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

    const titleElement = this.slideElem.querySelector('h1, h2, h3');
    config.options.title.fontSize = 
       parseInt(getComputedStyle(titleElement).getPropertyValue('font-size'));
    config.options.title.fontFamily = 
       getComputedStyle(titleElement).getPropertyValue('font-family');
    config.options.title.fontColor = 'silver';

    config.options.title.text = titleElement.innerText;

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

    let dataLabels = this.data.slice(1).map(a => a[0]);
    dataLabels.forEach((dl, idx) => {
      const color = config._options[dl.toLowerCase()];
      const dataset = {
        label: dl,
        borderColor: color ? color : 'black',
        data: []
      };
      config.data.datasets.push(dataset);
    })

    this.config = config;
    return this.config;
  }

  #createChart() {
    const ctx = this.canvasElem.getContext('2d');
    this.chart = new Chart(ctx, this.config);
    
    return this.chart;
  }
  
  #showNextDataPoint(evt) {
    // not the managed slide
    if (evt.detail.currentSlideElem !== this.slideElem) return;
    let columnIdx = evt.detail.lastPartialShownIndex;
    this.data.slice(1).forEach((row, rowIdx) => {
      const value = parseInt(row[columnIdx]);
      this.chart.data.datasets[rowIdx].data.push(value);
    });
    this.chart.update();
    this.#updateDataCard(columnIdx);
  }

  #updateDataCard(index) {
    
    if (this.imgElem) {
      //this.imgElem.transtionend = () => this.imgElem.parentNode.removeChild(this.imgElem);
      this.imgElem.classList.add('past');
      
      this.imgElem.style.top = parseInt(this.imgElem.style.top) * 0.5 + 'px'
    }
    

    this.imgElem = this.datacards[index]?.cloneNode();
    if (this.imgElem === undefined) return;

    this.imgElem.classList.add('datacard');
    this.imgElem.style.position = 'absolute';

    const chartCurrentX = this.chart.getDatasetMeta(0).data[index-1]._model.x;
    this.canvasElem.parentNode.appendChild(this.imgElem);
    // lets give some time to the browser to update the scene before using offsetWidth and offsetHeight
    setTimeout(() => {
      const displacement = 0.7 * (this.imgElem.offsetWidth * (this.chart.width / 2 < chartCurrentX ? -1 : 1));
      const imageX = chartCurrentX - this.imgElem.offsetWidth / 2 + displacement;
      const imageY = (this.chart.height - this.imgElem.offsetHeight) / 2;
      
      this.imgElem.style.left = parseInt(imageX) + 'px';
      this.imgElem.style.top = parseInt(imageY) + 'px';
      this.imgElem.classList.add('shown');
    }, 100);
  }


}

export default ChartSlideController;