// Forked from pptx2html/src/pptx_css.js (MIT)
// Changes: removed conflicting section{} overrides (height, border, border-radius,
// box-shadow, background-color, text-align) — our <section> elements carry inline
// styles for those properties.

export const pptxCss = `
section div.block {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
}

section div.content {
  display: flex;
  flex-direction: column;
}

section div.v-up   { justify-content: flex-start; }
section div.v-mid  { justify-content: center; }
section div.v-down { justify-content: flex-end; }

section div.h-left   { align-items: flex-start; text-align: left; }
section div.h-mid    { align-items: center;      text-align: center; }
section div.h-right  { align-items: flex-end;    text-align: right; }

section div.up-left      { justify-content: flex-start; align-items: flex-start;  text-align: left; }
section div.up-center    { justify-content: flex-start; align-items: center; }
section div.up-right     { justify-content: flex-start; align-items: flex-end; }
section div.center-left  { justify-content: center;     align-items: flex-start;  text-align: left; }
section div.center-center{ justify-content: center;     align-items: center; }
section div.center-right { justify-content: center;     align-items: flex-end; }
section div.down-left    { justify-content: flex-end;   align-items: flex-start;  text-align: left; }
section div.down-center  { justify-content: flex-end;   align-items: center; }
section div.down-right   { justify-content: flex-end;   align-items: flex-end; }

section span.text-block { }

section table {
  position: absolute;
}

section table,
section th,
section td {
  border: 1px solid black;
}

section svg.drawing {
  position: absolute;
  overflow: visible;
}
`;
