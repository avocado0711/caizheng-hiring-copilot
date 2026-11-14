from pathlib import Path

from pptx import Presentation


SOURCE = Path(__file__).with_name("才证_招聘决策台_黑客松路演.pptx")
OUTPUT = Path(__file__).with_name("diagnostics")


def trim_to_slides(source: Path, destination: Path, count: int) -> None:
    presentation = Presentation(source)
    slide_ids = list(presentation.slides._sldIdLst)
    for slide_id in slide_ids[count:]:
        presentation.part.drop_rel(slide_id.rId)
        presentation.slides._sldIdLst.remove(slide_id)
    presentation.save(destination)


def keep_only_slide(source: Path, destination: Path, slide_number: int) -> None:
    presentation = Presentation(source)
    slide_ids = list(presentation.slides._sldIdLst)
    for index, slide_id in enumerate(slide_ids, start=1):
        if index == slide_number:
            continue
        presentation.part.drop_rel(slide_id.rId)
        presentation.slides._sldIdLst.remove(slide_id)
    presentation.save(destination)


OUTPUT.mkdir(exist_ok=True)
for slide_count in range(1, 11):
    trim_to_slides(SOURCE, OUTPUT / f"slides-{slide_count:02d}.pptx", slide_count)
    print(OUTPUT / f"slides-{slide_count:02d}.pptx")
for slide_number in range(1, 11):
    keep_only_slide(SOURCE, OUTPUT / f"only-{slide_number:02d}.pptx", slide_number)
    print(OUTPUT / f"only-{slide_number:02d}.pptx")
