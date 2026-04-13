 # Create a PowerPoint application object
$ppt_app = New-Object -ComObject PowerPoint.Application

# Define the path where PowerPoint files are located
$source_folder = "c:\tmp\ppt"

# Set the desired DPI (e.g., 300 for high resolution)
$dpi = 300

# Get all PowerPoint files (.ppt or .pptx) in the source folder and its subfolders
Get-ChildItem -Path $source_folder -Recurse -Include *.ppt, *.pptx | ForEach-Object {
    Write-Host "Processing" $_.FullName "..."
    
    # Open the PowerPoint presentation
    $presentation = $ppt_app.Presentations.Open($_.FullName)
    
    # Create a folder for PNG exports
    $folder = Join-Path -Path $_.DirectoryName -ChildPath "$($_.BaseName)"
    New-Item -ItemType Directory -Force -Path $folder | Out-Null

    $mdContent = ""

    # Export each slide as high-resolution PNG
    for ($i = 1; $i -le $presentation.Slides.Count; $i++) {
		Write-Host "Slide" $i"."

        $mdContent += "### Slide $($slide.SlideIndex):`n"

        $slide = $presentation.Slides.Item($i)
        $png_filename = Join-Path -Path $folder -ChildPath "slide_$i.png"

        $mdContent += "![Slide $i]($png_filename)`n"
        
        # Calculate dimensions based on DPI
        $width = [int]($slide.Master.Width * $dpi / 72)
        $height = [int]($slide.Master.Height * $dpi / 72)
        
        # Export the slide as PNG with specified dimensions
        $slide.Export($png_filename, "PNG", $width, $height)
		
        $notes = $slide.NotesPage.Shapes | Where-Object {$_.PlaceholderFormat.Type -eq 2} | ForEach-Object {$_.TextFrame.TextRange.Text}
        
        if ($notes) {
			Write-Host "Markdown found."

            $md_filename = Join-Path -Path $folder -ChildPath "slide_$i.md"

            $notes | Out-File -FilePath $md_filename -Encoding UTF8
            
            # Convert to markdown using Pandoc (assumes Pandoc is installed and in PATH)
            pandoc -f docx -t markdown $md_filename -o $md_filename

            $mdNotes = Get-Content -Path $md_filename -Raw

            $mdContent += "::: Notes`n`n" + $mdNotes + ":::`n`n"
        }
    }

    # Replace multiple newlines with single newlines
    while ($mdContent -match "`n`n`n") {
        $mdContent = $mdContent -replace "`n`n`n", "`n`n"
    }
 
    # Export the README.md file with slide images and notes
    Write-Host "Exporting README.md file."
    $mdContent | Out-File -FilePath $folder\README.md -Encoding UTF8
    # Close the presentation without saving changes
    $presentation.Close()
}

# Quit PowerPoint application
$ppt_app.Quit()

# Clean up and release the COM object
[System.Runtime.InteropServices.Marshal]::ReleaseComObject($ppt_app)
