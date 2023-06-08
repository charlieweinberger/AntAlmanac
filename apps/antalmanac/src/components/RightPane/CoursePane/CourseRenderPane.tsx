import { IconButton, Theme } from '@material-ui/core';
import { withStyles } from '@material-ui/core/styles';
import { ClassNameMap, Styles } from '@material-ui/core/styles/withStyles';
import CloseIcon from '@material-ui/icons/Close';
import React, { PureComponent } from 'react';
import LazyLoad from 'react-lazyload';

import { Alert } from '@mui/material';
import RightPaneStore from '../RightPaneStore';
import GeDataFetchProvider from '../SectionTable/GEDataFetchProvider';
import SectionTableLazyWrapper from '../SectionTable/SectionTableLazyWrapper';
import SchoolDeptCard from './SchoolDeptCard';
import darkModeLoadingGif from './SearchForm/Gifs/dark-loading.gif';
import loadingGif from './SearchForm/Gifs/loading.gif';
import darkNoNothing from './static/dark-no_results.png';
import noNothing from './static/no_results.png';
import AppStore from '$stores/AppStore';
import { AACourse, AASection, Department, School, WebsocResponse } from '$lib/peterportal.types';
import { isDarkMode, queryWebsoc, queryWebsocMultiple } from '$lib/helpers';
import analyticsEnum from '$lib/analytics';

const styles: Styles<Theme, object> = (theme) => ({
    course: {
        ...theme.mixins.gutters(),
        paddingTop: theme.spacing(),
        paddingBottom: theme.spacing(),
        display: 'flex',
        alignItems: 'center',
        flexWrap: 'wrap',
        minHeight: theme.spacing(6),
        cursor: 'pointer',
    },
    text: {
        flexGrow: 1,
        display: 'inline',
        width: '100%',
    },
    ad: {
        flexGrow: 1,
        display: 'inline',
        width: '100%',
    },
    icon: {
        cursor: 'pointer',
        marginLeft: theme.spacing(),
    },
    root: {
        height: '100%',
        overflowY: 'scroll',
        position: 'relative',
    },
    noResultsDiv: {
        height: '100%',
        width: '100%',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingGifStyle: {
        height: '100%',
        width: '100%',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
    },
    spacing: {
        height: '50px',
        marginBottom: '5px',
    },
});

const flattenSOCObject = (SOCObject: WebsocResponse): (School | Department | AACourse)[] => {
    const courseColors = AppStore.getAddedCourses().reduce((accumulator, { section }) => {
        accumulator[section.sectionCode] = section.color;
        return accumulator;
    }, {} as { [key: string]: string });
    return SOCObject.schools.reduce((accumulator: (School | Department | AACourse)[], school) => {
        accumulator.push(school);

        school.departments.forEach((dept) => {
            accumulator.push(dept);

            dept.courses.forEach((course) => {
                for (const section of course.sections) {
                    (section as AASection).color = courseColors[section.sectionCode];
                }
                accumulator.push(course as AACourse);
            });
        });

        return accumulator;
    }, []);
};
const RecruitmentBanner = () => {
    const [bannerVisibility, setBannerVisibility] = React.useState<boolean>(true);

    // Display recruitment banner if more than 11 weeks (in ms) has passed since last dismissal
    const recruitmentDismissalTime = window.localStorage.getItem('recruitmentDismissalTime');
    const dismissedRecently =
        recruitmentDismissalTime !== null &&
        Date.now() - parseInt(recruitmentDismissalTime) < 11 * 7 * 24 * 3600 * 1000;
    const isSearchCS = ['COMPSCI', 'IN4MATX', 'I&C SCI', 'STATS'].includes(RightPaneStore.getFormData().deptValue);
    const displayRecruitmentBanner = bannerVisibility && !dismissedRecently && isSearchCS;

    return (
        <div style={{ position: 'fixed', bottom: 5, right: 5, zIndex: 999 }}>
            {displayRecruitmentBanner ? (
                <Alert
                    icon={false}
                    severity="info"
                    style={{
                        color: isDarkMode() ? '#ece6e6' : '#2e2e2e',
                        backgroundColor: isDarkMode() ? '#2e2e2e' : '#ece6e6',
                    }}
                    action={
                        <IconButton
                            aria-label="close"
                            size="small"
                            color="inherit"
                            onClick={() => {
                                window.localStorage.setItem('recruitmentDismissalTime', Date.now().toString());
                                setBannerVisibility(false);
                            }}
                        >
                            <CloseIcon fontSize="inherit" />
                        </IconButton>
                    }
                >
                    Interested in web development?
                    <br />
                    <a href="https://forms.gle/v32Cx65vwhnmxGPv8" target="__blank" rel="noopener noreferrer">
                        Join ICSSC and work on AntAlmanac and other projects!
                    </a>
                    <br />
                    We have opportunities for experienced devs and those with zero experience!
                </Alert>
            ) : null}{' '}
        </div>
    );
};

/* TODO: all this typecasting in the conditionals is pretty messy, but type guards don't really work in this context
 *  for reasons that are currently beyond me (probably something in the transpiling process that JS doesn't like).
 *  If you can find a way to make this cleaner, do it.
 */
const SectionTableWrapped = (
    index: number,
    data: { scheduleNames: string[]; courseData: (School | Department | AACourse)[] }
) => {
    const { courseData, scheduleNames } = data;
    const formData = RightPaneStore.getFormData();

    let component;

    if ((courseData[index] as School).departments !== undefined) {
        const school = courseData[index] as School;
        component = <SchoolDeptCard comment={school.schoolComment} type={'school'} name={school.schoolName} />;
    } else if ((courseData[index] as Department).courses !== undefined) {
        const dept = courseData[index] as Department;
        component = <SchoolDeptCard name={`Department of ${dept.deptName}`} comment={dept.deptComment} type={'dept'} />;
    } else if (formData.ge !== 'ANY') {
        const course = courseData[index] as AACourse;
        component = (
            <GeDataFetchProvider
                term={formData.term}
                courseDetails={course}
                colorAndDelete={false}
                highlightAdded={true}
                scheduleNames={scheduleNames}
                analyticsCategory={analyticsEnum.classSearch.title}
            />
        );
    } else {
        const course = courseData[index] as AACourse;
        component = (
            <SectionTableLazyWrapper
                term={formData.term}
                courseDetails={course}
                colorAndDelete={false}
                highlightAdded={true}
                scheduleNames={scheduleNames}
                analyticsCategory={analyticsEnum.classSearch.title}
            />
        );
    }

    return <div>{component}</div>;
};

interface CourseRenderPaneProps {
    classes: ClassNameMap;
}

interface CourseRenderPaneState {
    courseData: (School | Department | AACourse)[];
    loading: boolean;
    error: boolean;
    scheduleNames: string[];
}

class CourseRenderPane extends PureComponent<CourseRenderPaneProps, CourseRenderPaneState> {
    state: CourseRenderPaneState = {
        courseData: [],
        loading: true,
        error: false,
        scheduleNames: AppStore.getScheduleNames(),
    };

    loadCourses = () => {
        this.setState({ loading: true }, async () => {
            const formData = RightPaneStore.getFormData();

            const params = {
                department: formData.deptValue,
                term: formData.term,
                ge: formData.ge,
                restrictions: formData.restrictions,
                courseNumber: formData.courseNumber,
                sectionCodes: formData.sectionCode,
                instructorName: formData.instructor,
                units: formData.units,
                endTime: formData.endTime,
                startTime: formData.startTime,
                fullCourses: formData.coursesFull,
                building: formData.building,
                room: formData.room,
            };

            try {
                let jsonResp;
                if (params.units.includes(',')) {
                    jsonResp = await queryWebsocMultiple(params, 'units');
                } else {
                    jsonResp = await queryWebsoc(params);
                }

                // WHEN PETERPORTAL HAS AN ENDPOINT, GET RID OF THIS :)), AND MAYBE REDO THE RESTRICTION PARAMS TO MESH PROPERLY IF NEEDED ^
                if (params.restrictions === 'ALL') {
                    // console.log(flattenSOCObject(jsonResp)) // (31 in GE-5B)
                    this.setState({
                        loading: false,
                        error: false,
                        courseData: flattenSOCObject(jsonResp),
                    });
                } else {
                    // formData.restrictions is an array of strings BUT is of type string (?!)...
                    // so it must be converted to a string, split into an array (again), then can be filtered
                    // (ex: ["A", "B", "X", ''])
                    // if there's a cleaner way, please fix / LMK :)
                    const restrictionLetters = formData.restrictions.toString().includes(':')
                        ? formData.restrictions
                              .toString()
                              .split(',')
                              .map((value) => value.split(':')[0].trim())
                              .filter((value) => /^[A-Z]$/.test(value))
                              .sort((a, b) => a.localeCompare(b))
                        : formData.restrictions
                              .toString()
                              .split('')
                              .filter((value) => /^[A-Z]$/.test(value))
                              .sort((a, b) => a.localeCompare(b));

                    const courseData = flattenSOCObject(jsonResp)
                        // IF the letter is checked, it CANNOT be in the returned courses

                        // Filters for courses that have NONE of its restriction values within the search restriction params
                        // ex: 'C and D' with ["A", "B", "L", ""] works
                        // ex: 'A and D' with ["A", "B", "L", ""] does not work because "A" IS in the search restriction params
                        .filter((course) => {
                            // sections doesn't exist on type School, so it has to be pre-checked
                            if ('sections' in course) {
                                return course.sections[0].restrictions
                                    .split(' and ') // converts "A and L" into ["A", "L"]
                                    .every((element) => !restrictionLetters.includes(element));
                            }
                            return true;
                        })
                        // The prior filter may result in "empty" schools and/or departments, so this second round filters out any School | Department object which:
                        .filter((currentObj, index, array) => {
                            const nextIndex = index + 1;

                            if ('deptName' in currentObj) {
                                // A. The next object is a School | Department object (thus it must not have a course associatied)
                                if (nextIndex < array.length && currentObj.deptName) {
                                    return Object.prototype.hasOwnProperty.call(array[nextIndex], 'schoolName') ||
                                        Object.prototype.hasOwnProperty.call(array[nextIndex], 'deptName')
                                        ? false
                                        : true;
                                }

                                // B.The object is at the end of the array and is a School | Department object
                                if (
                                    index == array.length - 1 &&
                                    Object.prototype.hasOwnProperty.call(array[index], 'deptName')
                                ) {
                                    return false;
                                }
                            }
                            return true;
                        })
                        // The first filter may create an instance where there is an empty School and Department remaining.
                        // The second filter DOES removes the "empty" Department, but "forgets" to iterate back and check if School now has nothing following.
                        // This final filter checks for a final remaining School
                        .filter((obj, index, array) => {
                            return array.length == 1 ? false : true;
                        });

                    // console.log(courseData) // (16 in GE-5B; No A restrictions)
                    // Checks out because there are 15 total removed objects: courses (13), departments w/ only A courses (2: Stats & Math) 31-15=16!)
                    this.setState({
                        loading: false,
                        error: false,
                        courseData: courseData,
                    });
                }
            } catch (error) {
                this.setState({
                    loading: false,
                    error: true,
                });
            }
        });
    };

    componentDidMount() {
        this.loadCourses();
        AppStore.on('scheduleNamesChange', this.updateScheduleNames);
    }

    componentWillUnmount() {
        AppStore.removeListener('scheduleNamesChange', this.updateScheduleNames);
    }

    updateScheduleNames = () => {
        this.setState({ scheduleNames: AppStore.getScheduleNames() });
    };

    render() {
        const { classes } = this.props;
        let currentView;

        if (this.state.loading) {
            currentView = (
                <div className={classes.loadingGifStyle}>
                    <img src={isDarkMode() ? darkModeLoadingGif : loadingGif} alt="Loading courses" />
                </div>
            );
        } else if (!this.state.error) {
            const renderData = {
                courseData: this.state.courseData,
                scheduleNames: this.state.scheduleNames,
            };

            currentView = (
                <>
                    <RecruitmentBanner />
                    <div className={classes.root} style={{ position: 'relative' }}>
                        <div className={classes.spacing} />
                        {this.state.courseData.length === 0 ? (
                            <div className={classes.noResultsDiv}>
                                <img src={isDarkMode() ? darkNoNothing : noNothing} alt="No Results Found" />
                            </div>
                        ) : (
                            this.state.courseData.map((_: School | Department | AACourse, index: number) => {
                                let heightEstimate = 200;
                                if ((this.state.courseData[index] as AACourse).sections !== undefined)
                                    heightEstimate =
                                        (this.state.courseData[index] as AACourse).sections.length * 60 + 20 + 40;

                                return (
                                    <LazyLoad once key={index} overflow height={heightEstimate} offset={500}>
                                        {SectionTableWrapped(index, renderData)}
                                    </LazyLoad>
                                );
                            })
                        )}
                    </div>
                </>
            );
        } else {
            currentView = (
                <div className={classes.root}>
                    <div className={classes.noResultsDiv}>
                        <img src={isDarkMode() ? darkNoNothing : noNothing} alt="No Results Found" />
                    </div>
                </div>
            );
        }

        return currentView;
    }
}

export default withStyles(styles)(CourseRenderPane);
