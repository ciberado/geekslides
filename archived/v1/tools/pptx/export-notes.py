import sys
from pptx import Presentation


def main(file):
    # file = '/mnt/d/data/OneDrive - NTT/aws/devops/01_Introduction_to_devops.pptx'
    ppt=Presentation(file)

    notes = []

    for page, slide in enumerate(ppt.slides):
        # this is the notes that doesn't appear on the ppt slide,
        # but really the 'presenter' note. 
        textNote = slide.notes_slide.notes_text_frame.text

        notes.append('[](#slide' + str(page+1) + ',bgurl(Slide' + str(page+1) + '.SVG))\r\n\r\n')

        if textNote:
            notes.append('::: Notes' + '\r\n\r\n')
            notes.append(textNote.strip() + '\r\n\r\n') 
            notes.append(':::' + '\r\n\r\n')

    print(''.join(notes))


file = sys.argv[1];
main(file);