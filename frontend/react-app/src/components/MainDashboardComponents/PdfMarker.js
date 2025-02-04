import React, { useState, useRef, useEffect } from "react"
import { Button } from "../ui/button"
import { Card, CardHeader, CardTitle, CardContent } from "../ui/card"
import {
  X,
  ZoomIn,
  ZoomOut,
  ChevronLeft,
  ChevronRight,
  Upload,
  GripVertical,
  Undo2,
  Redo2,
} from "lucide-react"
import { pdfjs, Document, Page } from "react-pdf"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select"
import { Tabs, TabsList, TabsTrigger } from "../ui/tabs"

// pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString()
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
const COLUMN_TYPES = [
  { id: "date", label: "📅 Date" },
  { id: "description", label: "📝 Description" },
  { id: "credit", label: "💵 Credit" },
  { id: "debit", label: "💷 Debit" },
  { id: "amount (dr/cr)", label: "💰 Amount (DR/CR)" },
  { id: "balance", label: "🏦 Balance" },
  { id: "dr/cr", label: "💶 DR/CR" },
  { id: "amount", label: "🪙 Amount" },
  { id: "Skip", label: "⏩ Skip" },
]

const COLUMN_COLORS = [
  { bg: "bg-blue-200", text: "text-blue-700", border: "border-blue-400" },
  { bg: "bg-green-200", text: "text-green-700", border: "border-green-400" },
  { bg: "bg-purple-200", text: "text-purple-700", border: "border-purple-400" },
  { bg: "bg-orange-200", text: "text-orange-700", border: "border-orange-400" },
  { bg: "bg-pink-200", text: "text-pink-700", border: "border-pink-400" },
]
const initialConfigTest = {
  lines: [
    // { x: 71.70364379882812 },
    // { x: 448.39697265625 },
    // { x: 368.84112548828125 },
    // { x: 522.9741821289062 },
    // { x: 129.44998168945312 },
    // { x: 272.2314758300781 },
    // { x: 19.830726623535156 },
    // { x: 582.7577514648438 },
  ],
  
}
const PDFColumnMarker = ({ addColsToStatementData, pdfPath,initialConfig = initialConfigTest }) => {
  const [columnLines, setColumnLines] = useState([])
  const [columnLabels, setColumnLabels] = useState([])
  const [pdfFile, setPdfFile] = useState(null)
  const [numPages, setNumPages] = useState(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [scale, setScale] = useState(1.4)
  const [editingLabelIndex, setEditingLabelIndex] = useState(null)
  const [draggingLineIndex, setDraggingLineIndex] = useState(null)
  const [draggingLabelIndex, setDraggingLabelIndex] = useState(null)
  const [isDragging, setIsDragging] = useState(false)
  const [currentStep, setCurrentStep] = useState("lines")
  const [usedColumnTypes, setUsedColumnTypes] = useState([])
  const [history, setHistory] = useState([])
  const [historyIndex, setHistoryIndex] = useState(-1)
  const [labelSelectorOpen, setLabelSelectorOpen] = useState(true)
  const [pdfBlob, setPdfBlob] = useState(null)

  const pdfContainerRef = useRef(null)


  useEffect(() => {

    if (initialConfig && pdfBlob) {
      if (initialConfig.lines) {
        // sort the lines
        const sortedInitialLines =initialConfig.lines.map((line) => ({
          id: Date.now() + Math.random(),
          x: line.x,
        })).sort((a, b) => a.x - b.x)
        console.log({sortedInitialLines})
        setColumnLines(sortedInitialLines)
      }

      if (initialConfig.labels) {
        setColumnLabels(
          initialConfig.labels.map((label, index) => ({
            id: Date.now() + Math.random(),
            x: label.x,
            type: label.type,
            label: label.label || COLUMN_TYPES.find((t) => t.id === label.type)?.label || "",
            colorIndex: index % COLUMN_COLORS.length,
          })),
        )
        // setCurrentStep("labels")
      }
    }
  }, [initialConfig, pdfBlob])

  useEffect(() => {
    console.log({OpeningPDf:pdfPath})
    window.electron.fetchPdfContent(pdfPath)
      .then(base64 => {
        const blob = base64StringToBlob(base64, 'application/pdf');
        setPdfBlob(URL.createObjectURL(blob));
        console.log('Fetched PDF:', blob);
      })
      .catch(err => console.error('Failed to fetch PDF:', err));
  }, []);

  const base64StringToBlob = (base64, type) => {
    const binaryString = window.atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return new Blob([bytes], {type: type});
  };


  const handleClick = (e) => {
    // if (!pdfFile || isDragging) return
    if (!pdfBlob || isDragging) return

    if (draggingLineIndex !== null || draggingLabelIndex !== null) {
      return
    }

    const rect = pdfContainerRef.current.getBoundingClientRect()
    const x = (e.clientX - rect.left) / scale
    const y = (e.clientY - rect.top) / scale

    if (currentStep === "lines") {
      const newColumnLines = [...columnLines, { id: Date.now(), x }].sort((a, b) => a.x - b.x)
      setColumnLines(newColumnLines)

      // Automatically show dropdown between two lines
      if (newColumnLines.length >= 2) {
        for (let i = 0; i < newColumnLines.length; i++) {
          if (newColumnLines[i].x === x) {
            const midX = (newColumnLines[i].x + newColumnLines[i - 1].x) / 2
            // if (!columnLabels.some((label) => label.x === midX)) {
            setColumnLabels((prev) => [
              ...prev,
              {
                id: Date.now() + Math.random(),
                x: midX,
                type: "",
                label: "",
                colorIndex: prev.length % COLUMN_COLORS.length,
              },
            ])
            setEditingLabelIndex(columnLabels.length)
            break
            // }
          }
        }
      }
    } else if (currentStep === "labels") {
      // find col start and col end of this col
      const colEnd = columnLines.findIndex((line) => {
          return line.x > x;
      });
      const colStart = colEnd-1;
      if (colStart === -1 || colEnd === -1) return


      // columnLabels.map((label,index)=>{
      //   if(label.x > columnLines[colStart].x && label.x < columnLines[colEnd].x){

      //   }
      // })

      // check if this col already has a label
      // if (columnLabels.some((label) => label.x > columnLines[colStart].x && label.x < columnLines[colEnd].x)) {
      //   return
      // }

      const newColumnLabels = [
        ...columnLabels,
        { id: Date.now(), x, y, type: "", label: "", colorIndex: columnLabels.length % COLUMN_COLORS.length },
      ]
      setColumnLabels(newColumnLabels)
      setEditingLabelIndex(newColumnLabels.length - 1)
      setLabelSelectorOpen(true)
    }
    updateHistory(columnLines, columnLabels)
  }

  const handleDragStart = (e, index, type) => {
    e.preventDefault()
    e.stopPropagation()
    if (type === "line") {
      setDraggingLineIndex(index)
    } else {
      setDraggingLabelIndex(index)
    }
    setIsDragging(true)
  }

  const handleDrag = (e) => {
    if ((draggingLineIndex === null && draggingLabelIndex === null) || !pdfContainerRef.current) return

    e.preventDefault()
    e.stopPropagation()

    const rect = pdfContainerRef.current.getBoundingClientRect()
    const currentX = (e.clientX - rect.left) / scale


    if (draggingLineIndex !== null) {
      setColumnLines((prev) =>
        prev.map((line, i) => {
          if (i === draggingLineIndex) {
            return { ...line, x: currentX }
          }
          return line
        }),
      )
    } else if (draggingLabelIndex !== null) {
      setColumnLabels((prev) =>
        prev.map((label, i) => {
          if (i === draggingLabelIndex) {
            return { ...label, x: currentX }
          }
          return label
        }),
      )
    }
  }

  const handleDragEnd = (e) => {
    if (e) {
      e.preventDefault()
      e.stopPropagation()
    }

    setTimeout(() => {
      setIsDragging(false)
    }, 100)

    setDraggingLineIndex(null)
    setDraggingLabelIndex(null)
  }

  const handleColumnTypeSelect = (labelIndex, typeId) => {
    setColumnLabels((prev) => {
      const newLabels = prev.map((label, i) =>
        i === labelIndex
          ? {
              ...label,
              type: typeId,
              label: COLUMN_TYPES.find((t) => t.id === typeId)?.label || "",
            }
          : label,
      )
      updateHistory(columnLines, newLabels)
      return newLabels
    })
    if(typeId !== "Skip")
      setUsedColumnTypes((prev) => [...prev, typeId])
    setEditingLabelIndex(null)
  }

  const removeColumnLine = (index) => {
    setColumnLines((prev) => prev.filter((_, i) => i !== index))
    updateHistory(
      columnLines.filter((_, i) => i !== index),
      columnLabels,
    )
  }

  const removeColumnLabel = (index) => {
    setColumnLabels((prev) => prev.filter((_, i) => i !== index))
    setUsedColumnTypes((prev) => prev.filter((type) => type !== columnLabels[index].type))
    updateHistory(
      columnLines,
      columnLabels.filter((_, i) => i !== index),
    )
  }

  const handleFileChange = (event) => {
    const file = event.target.files[0]
    if (file) {
      setPdfFile(file)

      if (!initialConfig) {
        setColumnLines([])
        setColumnLabels([])
        // setTableBounds({ start: null, end: null })
        setCurrentStep("lines")
      }

      setCurrentPage(1)
    }
  }

  const onDocumentLoadSuccess = ({ numPages }) => {
    setNumPages(numPages)
  }

  const getInstructionText = () => {
    // if (currentStep === "lines") {
    return "Click to add column dividers and table boundaries - make sure to mark both edges of the table!"
    // }
    // return "Click between the lines to add column labels"
  }

  const handleSubmit = () => {
    const requiredTypes = ["balance", "date", "description"]
    const selectedTypes = columnLabels.map((label) => label.type)

    // if (!requiredTypes.every((type) => selectedTypes.includes(type))) {
    //   alert("Please select Balance, Date, and Description columns before submitting.")
    //   return
    // }

    const sortedLines = [...columnLines].sort((a, b) => a.x - b.x)

    const columns = []
    for (let i = 0; i < sortedLines.length - 1; i++) {
      const startX = sortedLines[i].x
      const endX = sortedLines[i + 1].x

      const label = columnLabels.find((label) => label.x >= startX && label.x <= endX)

      columns.push({
        index: i,
        bounds: {
          start: startX,
          end: endX,
        },
        type: label?.type || null,
      })
    }

    const config = {
      columns,
    }

    console.log({pdfPath,config})
    addColsToStatementData(pdfPath,config.columns)
  }

  const updateHistory = (lines, labels) => {
    const newHistory = history.slice(0, historyIndex + 1)
    newHistory.push({ lines: [...lines], labels: [...labels] })
    setHistory(newHistory)
    setHistoryIndex(newHistory.length - 1)
  }

  const undo = () => {
    if (historyIndex > 0) {
      setHistoryIndex(historyIndex - 1)
      const { lines, labels } = history[historyIndex - 1]
      setColumnLines(lines)
      setColumnLabels(labels)
    }
  }

  const redo = () => {
    if (historyIndex < history.length - 1) {
      setHistoryIndex(historyIndex + 1)
      const { lines, labels } = history[historyIndex + 1]
      setColumnLines(lines)
      setColumnLabels(labels)
    }
  }

  const renderColoredColumns = () => {
    return columnLabels.map((label, index) => {
      if (!label.type || label.type === "Skip") return null
      const x = label.x
      const endIndex = columnLines.findIndex((line) => {
          return line.x > x;
      });
      const startIndex = endIndex-1;
      const startX = columnLines[startIndex]?.x || 0
      const endX = columnLines[endIndex]?.x || 0

      // const startX = columnLines[index]?.x || 0
      // const endX = columnLines[index + 1]?.x || 0
      const width = endX - startX

      // console.log({startIndex,endIndex,startX, endX, width, label})
      const colorIndex = COLUMN_TYPES.findIndex((type) => type.id === label.type) % COLUMN_COLORS.length
      return (
        <div
          key={label.id}
          className={`absolute top-0 h-full ${COLUMN_COLORS[colorIndex].bg} opacity-20`}
          style={{
            left: `${startX * scale}px`,
            width: `${width * scale}px`,
          }}
        />
      )
    })
  }

  

  return (
    <Card className="w-full max-w-4xl mx-auto ">
      <CardHeader className="space-y-6">
        <CardTitle>PDF Column Marker</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6 overflow-hidden">
        <div className="bg-gray-50 p-4 rounded-lg">
          <p className="text-sm text-gray-600">{getInstructionText()}</p>
          <div className="text-xs text-gray-500 flex gap-x-4 mt-2">
            <p>
              • Drag <GripVertical className="inline h-3 w-3" /> to move items
            </p>
            <p>
              • Click <X className="inline h-3 w-3" /> to delete items
            </p>
          </div>
        </div>

        {/* {!pdfFile ? (
          <div className="flex justify-center">
            <label className="relative cursor-pointer bg-gray-50 rounded-lg p-6 border-2 border-dashed border-gray-300 hover:border-gray-400 transition-colors w-full">
              <div className="text-center">
                <Upload className="mx-auto h-12 w-12 text-gray-400" />
                <div className="mt-2">
                  <span className="text-sm font-medium text-gray-900">Drop PDF here or click to upload</span>
                </div>
              </div>
              <input type="file" accept=".pdf" onChange={handleFileChange} className="hidden" />
            </label>
          </div>
        ) : ( */}

          <>
          <div className="flex justify-between">
              <Button
                variant="outline"
                onClick={() => {
                  // setTableBounds({ start: null, end: null })
                  setColumnLines([])
                  setColumnLabels([])
                  setUsedColumnTypes([])
                }}
              >
                Start Over
              </Button>
              <Button className="ml-auto" onClick={handleSubmit}>
                Save Column Mapping
              </Button>
            </div>
            <div className="flex items-center justify-between bg-gray-50 p-2 rounded-lg  ">
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" onClick={undo} disabled={historyIndex <= 0}>
                  <Undo2 className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={redo} disabled={historyIndex >= history.length - 1}>
                  <Redo2 className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex items-center gap-2 text-nowrap">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                  disabled={currentPage <= 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span>
                  Page {currentPage} of {numPages || "?"}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setCurrentPage((prev) => Math.min(prev + 1, numPages || prev))}
                  disabled={currentPage >= (numPages || 1)}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>

              <div className="flex items-center gap-2 text-nowrap">
                <Button variant="ghost" size="icon" onClick={() => setScale((prev) => Math.max(0.1, prev - 0.1))}>
                  <ZoomOut className="h-4 w-4" />
                </Button>
                <span>{Math.round(scale * 100)}%</span>
                <Button variant="ghost" size="icon" onClick={() => setScale((prev) => prev + 0.1)}>
                  <ZoomIn className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div
              ref={pdfContainerRef}
              className="relative bg-gray-50 rounded-lg overflow-hidden "
              style={{ cursor: "crosshair" }}
              onClick={handleClick}
              onMouseMove={handleDrag}
              onMouseUp={handleDragEnd}
              onMouseLeave={handleDragEnd}
            >

              {console.log({pdfBlob})}
              <Document className={"overflow-auto"} style={{overflow:"auto"}} file={pdfBlob} onLoadSuccess={onDocumentLoadSuccess}>
                <Page pageNumber={currentPage} scale={scale} renderTextLayer={false} renderAnnotationLayer={false} />
                {/* 
                {tableBounds.start !== null && (
                  <div
                    className="absolute top-0 h-full border-l-2 border-red-500"
                    style={{ left: `${tableBounds.start * scale}px` }}
                  >
                    <div className="absolute top-2 -translate-x-1/2 px-2 py-1 rounded bg-red-100 text-red-700 text-sm font-medium whitespace-nowrap">
                      Table Start
                    </div>
                  </div>
                )}
                {tableBounds.end !== null && (
                  <div
                    className="absolute top-0 h-full border-l-2 border-red-500"
                    style={{ left: `${tableBounds.end * scale}px` }}
                  >
                    <div className="absolute top-2 -translate-x-1/2 px-2 py-1 rounded bg-red-100 text-red-700 text-sm font-medium whitespace-nowrap">
                      Table End
                    </div>
                  </div>
                )} */}

                {columnLines.map((line, index) => (
                  <div key={line.id} className="absolute top-0 h-full" style={{ left: `${line.x * scale}px` ,zIndex: 99}}>
                    <div className="h-full bg-gray-400 border-l-2 border-gray-500" />

                    <div className="absolute top-2  items-center">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 cursor-move"
                        onMouseDown={(e) => handleDragStart(e, index, "line")}
                      >
                        <GripVertical className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={(e) => {
                          e.stopPropagation()
                          removeColumnLine(index)
                        }}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}

                {columnLabels.map((label, index) => (
                  <div
                    key={label.id}
                    className={`absolute `}
                    style={{
                      left: `${label.x * scale}px`,
                      // top:label.y?`${label.y * scale}px`:`top-[${15+(5*(index+1))}%]`,
                      top: label.y ? label.y : `${15 + 5 * (index + 1)}%`,
                      transform: "translateX(-50%)",
                      zIndex: 99,
                    }}
                  >
                    <div className="flex flex-col items-center">
                      <div className="flex items-center gap-1 mb-2">
                        {/* <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 cursor-move"
                          onMouseDown={(e) => handleDragStart(e, index, "label")}
                        >
                          <GripVertical className="h-4 w-4" />
                        </Button> */}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={(e) => {
                            e.stopPropagation()
                            removeColumnLabel(index)
                          }}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>

                      {editingLabelIndex === index ? (
                        <Select style={{ zIndex: 999 }} open={labelSelectorOpen}  value={label.type} onValueChange={(value) => handleColumnTypeSelect(index, value)}>
                          
                          <SelectTrigger className="w-48">
                            <SelectValue placeholder="Select column type" />
                          </SelectTrigger>
                          <SelectContent style={{ zIndex: 999 }}  

                          >
                            {COLUMN_TYPES.filter((type) => !usedColumnTypes.includes(type.id)).map((type) => (
                              <SelectItem key={type.id} value={type.id}>
                                {type.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <div
                          className={`px-2 py-1 rounded cursor-pointer
                            ${COLUMN_COLORS[label.colorIndex].bg} ${COLUMN_COLORS[label.colorIndex].text}
                            text-sm font-medium whitespace-nowrap`}
                            onClick={(e) => {
                              e.stopPropagation()
                              setEditingLabelIndex(index)
                            }}
                        >
                          {label.label || "Click to label"}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {renderColoredColumns()}
              </Document>
            </div>

         

            {/* right - side tabs */}
            <div
              className={`fixed right-0 top-1/2 transform -translate-y-1/2 z-[99] transition-all duration-300 ${"w-auto"}`}
            >
              <Tabs
                value={currentStep}
                onValueChange={(value) => setCurrentStep(value)}
                orientation="vertical"
                className="h-full "
              >
                <TabsList className="flex flex-col  h-full bg-white shadow-lg border">
                  {/* <div 
            className="cursor-pointer p-2 hover:bg-gray-100"
            onClick={() => setIsOpen(!isOpen)}
          >
            <ChevronRight 
              className={`transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} 
            />
          </div> */}

                  <TabsTrigger value="lines" className="w-full flex items-center justify-center p-2 hover:bg-gray-100">
                    {/* <BookmarkIcon size={20} /> */}
                    Line
                    {/* {isOpen && <span className="ml-2">Place Line</span>} */}
                  </TabsTrigger>

                  <TabsTrigger value="labels" className="w-full flex items-center justify-center p-2 hover:bg-gray-100">
                    Labels
                    {/* <BookmarkIcon size={20} /> */}
                    {/* {isOpen && <span className="ml-2">Place Labels</span>} */}
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </>
        {/* )} */}
      </CardContent>
    </Card>
  )
}

export default PDFColumnMarker

